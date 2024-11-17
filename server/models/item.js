const BaseModel = require('./BaseModel');
const getAllItemsQuery = require('./queries/items/getAllItems');
const getItemByIdQuery = require('./queries/items/getItemById');

class ItemModel extends BaseModel {
    constructor(db) {
        super(db);
    }

    async getAllItems() {
        try {
            const rows = await this.executeQuery(getAllItemsQuery);
            return rows.map(row => this.parseJsonFields(row, ['referenceChange', 'referencedBy']));
        } catch (err) {
            console.error('Error getting items:', err);
            throw err;
        }
    }

    async getItemById(itemId) {
        try {
            const row = await this.executeQuerySingle(
                getItemByIdQuery, 
                [itemId, itemId, itemId, itemId, itemId, itemId, itemId, itemId, itemId]
            );
            if (!row) return null;
            
            const parsedRow = this.parseJsonFields(row, [
                'referenceChange', 
                'referencedBy',
                'priceHistory',
                'supplierPrices',
                'promotions'
            ]);

            return parsedRow;
        } catch (err) {
            console.error('Error getting item:', err);
            throw err;
        }
    }

    async createItem(data) {
        const createItemQuery = async (db) => {
            await this._insertItemBase(db, data);
            if (this._hasRetailPrice(data)) {
                await this._insertItemHistory(db, data);
            }
        };

        try {
            await this.executeTransaction(createItemQuery);
            return data;
        } catch (err) {
            console.error('Error creating item:', err);
            throw err;
        }
    }

    async updateItem(itemId, data, image = null) {
        const updateItemQuery = async (db) => {
            await this._updateItemBase(db, itemId, data, image);
            await this._updateInquiryItem(db, itemId, data);
            if (this._hasRetailPrice(data)) {
                await this._insertItemHistory(db, { ...data, itemID: itemId });
            }
        };

        try {
            await this.executeTransaction(updateItemQuery);
        } catch (err) {
            console.error('Error updating item:', err);
            throw err;
        }
    }

    async deleteItem(itemId) {
        const deleteItemQuery = async (db) => {
            const tables = [
                'InquiryItem',
                'SupplierResponse',
                'Promotion',
                'ItemHistory',
                'Item'
            ];

            // Delete from ItemReferenceChange separately due to multiple conditions
            await this._deleteItemReference(db, itemId);

            // Delete from other tables
            for (const table of tables) {
                await this._deleteFromTable(db, table, itemId);
            }
        };

        try {
            await this.executeTransaction(deleteItemQuery);
        } catch (err) {
            console.error('Error deleting item:', err);
            throw err;
        }
    }

    async addReferenceChange(itemId, newReferenceId, supplierId, notes) {
        if (itemId === newReferenceId) return;

        const addReferenceQuery = async (db) => {
            const existingItem = await this._checkItemExists(db, newReferenceId);
            if (!existingItem) {
                await this._createReferenceItem(db, newReferenceId);
            }
            await this._deleteSelfReferences(db);
            await this._insertReferenceChange(db, itemId, newReferenceId, supplierId, notes);
        };

        try {
            await this.executeTransaction(addReferenceQuery);
        } catch (err) {
            console.error('Error adding reference change:', err);
            throw err;
        }
    }

    // Private helper methods
    _hasRetailPrice(data) {
        return data.retailPrice !== undefined && data.retailPrice !== null;
    }

    async _insertItemBase(db, data) {
        const query = `
            INSERT INTO Item (
                ItemID,
                HebrewDescription,
                EnglishDescription,
                ImportMarkup,
                HSCode,
                Image
            ) VALUES (?, ?, ?, ?, ?, ?)
        `;
        const params = [
            data.itemID,
            data.hebrewDescription,
            data.englishDescription || '',
            data.importMarkup || 1.30,
            data.hsCode || '',
            data.image || ''
        ];

        return new Promise((resolve, reject) => {
            db.run(query, params, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async _insertItemHistory(db, data) {
        const query = `
            INSERT INTO ItemHistory (
                ItemID,
                ILSRetailPrice,
                QtyInStock,
                QtySoldThisYear,
                QtySoldLastYear,
                Date
            ) VALUES (?, ?, ?, ?, ?, datetime('now'))
        `;
        const params = [
            data.itemID,
            data.retailPrice,
            data.qtyInStock || 0,
            data.soldThisYear || 0,
            data.soldLastYear || 0
        ];

        return new Promise((resolve, reject) => {
            db.run(query, params, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async _updateItemBase(db, itemId, data, image) {
        const query = `
            UPDATE Item SET 
                HebrewDescription = ?,
                EnglishDescription = ?,
                ImportMarkup = ?,
                HSCode = ?
                ${image ? ', Image = ?' : ''}
            WHERE ItemID = ?
        `;
        const params = [
            data.hebrewDescription,
            data.englishDescription || '',
            data.importMarkup || 1.30,
            data.hsCode || '',
            ...(image ? [image] : []),
            itemId
        ];

        const result = await new Promise((resolve, reject) => {
            db.run(query, params, function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });

        if (result === 0) {
            throw new Error('Item not found');
        }
    }

    async _updateInquiryItem(db, itemId, data) {
        const query = `
            UPDATE InquiryItem SET 
                HebrewDescription = ?,
                EnglishDescription = ?,
                ImportMarkup = ?,
                HSCode = ?,
                QtyInStock = ?,
                RetailPrice = ?,
                SoldThisYear = ?,
                SoldLastYear = ?
            WHERE ItemID = ?
        `;
        const params = [
            data.hebrewDescription,
            data.englishDescription || '',
            data.importMarkup || 1.30,
            data.hsCode || '',
            data.qtyInStock || 0,
            data.retailPrice,
            data.soldThisYear || 0,
            data.soldLastYear || 0,
            itemId
        ];

        return new Promise((resolve, reject) => {
            db.run(query, params, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async _deleteItemReference(db, itemId) {
        return new Promise((resolve, reject) => {
            db.run(
                'DELETE FROM ItemReferenceChange WHERE OriginalItemID = ? OR NewReferenceID = ?',
                [itemId, itemId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    async _deleteFromTable(db, table, itemId) {
        return new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM ${table} WHERE ItemID = ?`,
                [itemId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    async _checkItemExists(db, itemId) {
        return new Promise((resolve, reject) => {
            db.get('SELECT ItemID FROM Item WHERE ItemID = ?', [itemId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    async _createReferenceItem(db, itemId) {
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO Item (ItemID, HebrewDescription, EnglishDescription, ImportMarkup)
                 VALUES (?, 'New reference item', 'New reference item', 1.30)`,
                [itemId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO ItemHistory (ItemID, ILSRetailPrice, QtyInStock, QtySoldThisYear, QtySoldLastYear, Date)
                 VALUES (?, NULL, 0, 0, 0, datetime('now'))`,
                [itemId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    async _deleteSelfReferences(db) {
        return new Promise((resolve, reject) => {
            db.run(
                `DELETE FROM ItemReferenceChange 
                 WHERE OriginalItemID = NewReferenceID`,
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    async _insertReferenceChange(db, itemId, newReferenceId, supplierId, notes) {
        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO ItemReferenceChange (
                    OriginalItemID,
                    NewReferenceID,
                    ChangedByUser,
                    SupplierID,
                    Notes,
                    ChangeDate
                ) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
                [itemId, newReferenceId, !supplierId, supplierId, notes],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }
}

module.exports = ItemModel;
