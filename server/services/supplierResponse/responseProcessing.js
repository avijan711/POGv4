const debug = require('../../utils/debug');
const ExcelProcessor = require('../../utils/excelProcessor');

class ResponseProcessing {
    constructor(db, itemUpdates, responseQueries) {
        this.db = db;
        this.itemUpdates = itemUpdates;
        this.responseQueries = responseQueries;
    }

    cleanItemCode(itemCode) {
        if (!itemCode) return itemCode;
        const cleaned = itemCode.replace(/^['']/, '').trim();
        if (cleaned !== itemCode) {
            debug.log(`Cleaned item code: '${itemCode}' -> '${cleaned}'`);
        }
        return cleaned;
    }

    validateData(data) {
        return data.map(item => {
            // Clean the item codes
            const cleanedItemId = this.cleanItemCode(item.item_id);
            const cleanedNewRefId = item.new_reference_id ? 
                this.cleanItemCode(item.new_reference_id) : null;

            // Check if new_reference_id exists and is different from item_id
            const newRef = cleanedNewRefId && cleanedNewRefId !== cleanedItemId ? 
                         cleanedNewRefId : null;

            return {
                item_id: cleanedItemId,
                price: item.price,
                notes: item.notes,
                hs_code: item.hs_code,
                english_description: item.english_description,
                origin: item.origin,
                new_reference_id: newRef
            };
        });
    }

    async processItems(validData, inquiryId) {
        for (const item of validData) {
            debug.log('Processing item:', item);

            // Check and create original item if needed
            const { existsInInquiry, existsInItemTable } = 
                await this.itemUpdates.verifyItemExists(item.item_id, inquiryId);
            
            debug.log('Original item exists:', {
                itemId: item.item_id,
                existsInInquiry,
                existsInItemTable
            });

            if (!existsInInquiry) {
                debug.log(`Item ${item.item_id} not found in inquiry ${inquiryId}. Skipping.`);
                continue;
            }

            if (!existsInItemTable) {
                await this.itemUpdates.createUnknownItem(item.item_id, inquiryId);
                debug.log('Created unknown item:', item.item_id);
            }

            // Always update item details, even if fields are empty
            await this.itemUpdates.updateItemDetails(item.item_id, {
                hs_code: item.hs_code,
                english_description: item.english_description,
                origin: item.origin
            });

            // Check and create reference item if needed
            if (item.new_reference_id) {
                await this.processReferenceItem(item, inquiryId);
            }
        }
    }

    async processReferenceItem(item, inquiryId) {
        const { existsInInquiry, existsInItemTable } = 
            await this.itemUpdates.verifyItemExists(item.new_reference_id, inquiryId);
        
        debug.log('Reference item exists:', {
            referenceId: item.new_reference_id,
            existsInInquiry,
            existsInItemTable
        });

        if (!existsInInquiry) {
            debug.log(`Reference item ${item.new_reference_id} not found in inquiry ${inquiryId}. Skipping reference.`);
            item.new_reference_id = null;
            return;
        }

        if (!existsInItemTable) {
            await this.itemUpdates.createUnknownItem(item.new_reference_id, inquiryId);
            debug.log('Created unknown reference item:', item.new_reference_id);
        }
    }

    async processResponses(validData, inquiryId, supplierId) {
        for (const item of validData) {
            debug.log('Creating supplier response for item:', item);

            // Insert supplier response record
            const responseId = await this.responseQueries.insertSupplierResponse(
                inquiryId,
                supplierId,
                item.item_id,
                item.price
            );

            // Insert supplier response item
            await this.responseQueries.insertSupplierResponseItem(responseId, item);

            // Handle reference changes if needed
            if (item.new_reference_id) {
                await this.processReferenceChange(item, supplierId, inquiryId);
            }
        }
    }

    async processReferenceChange(item, supplierId, inquiryId) {
        debug.log('Creating reference change:', {
            originalId: item.item_id,
            newId: item.new_reference_id
        });

        // Insert reference change record
        await this.responseQueries.insertReferenceChange(
            item.item_id,
            item.new_reference_id,
            supplierId,
            item.notes
        );

        // Update inquiry item with reference
        await this.itemUpdates.updateInquiryItemReference(
            item.item_id,
            item.new_reference_id,
            item.notes,
            inquiryId
        );
    }

    async processUpload(file, columnMapping, supplierId, inquiryId) {
        debug.log('Processing supplier response upload:', {
            filename: file.filename,
            supplierId,
            inquiryId,
            mappingKeys: Object.keys(columnMapping)
        });

        try {
            // Process the uploaded file
            const data = await ExcelProcessor.processResponse(file.path, columnMapping, {
                requiredFields: ['item_id']
            });

            debug.log('Processed Excel data:', {
                sampleRow: data[0],
                totalRows: data.length
            });

            // Validate and clean the data
            const validData = this.validateData(data);

            // Begin transaction
            await new Promise((resolve, reject) => {
                this.db.run('BEGIN TRANSACTION', err => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            try {
                // Process items first
                await this.processItems(validData, inquiryId);

                // Then process responses and reference changes
                await this.processResponses(validData, inquiryId, supplierId);

                // Clean up any self-references
                await this.responseQueries.cleanupSelfReferences(inquiryId);
                await this.responseQueries.cleanupReferenceChanges();

                // Update response status to active
                await this.responseQueries.updateResponseStatus(inquiryId, supplierId);

                // Commit transaction
                await new Promise((resolve, reject) => {
                    this.db.run('COMMIT', err => {
                        if (err) reject(err);
                        else resolve();
                    });
                });

                debug.log('Successfully processed supplier response:', {
                    itemCount: validData.length
                });

                return {
                    success: true,
                    itemCount: validData.length
                };

            } catch (error) {
                // Rollback transaction on error
                debug.error('Error during processing, rolling back:', error);
                await new Promise((resolve) => {
                    this.db.run('ROLLBACK', () => resolve());
                });
                throw error;
            }

        } catch (error) {
            debug.error('Error processing supplier response:', error);
            throw new Error(`Failed to process supplier response: ${error.message}`);
        }
    }
}

module.exports = ResponseProcessing;
