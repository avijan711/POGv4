const express = require('express');
const cors = require('cors');

function createRouter(db) {
    const router = express.Router();

    // Enable CORS
    router.use(cors({
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true
    }));

    // Get all suppliers
    router.get('/', (req, res) => {
        console.log('Fetching suppliers');
        db.all('SELECT SupplierID, Name, ContactPerson, Email, Phone FROM Supplier ORDER BY Name', [], (err, rows) => {
            if (err) {
                console.error('Error fetching suppliers:', err);
                res.status(500).json({ error: 'Failed to fetch suppliers' });
                return;
            }
            console.log('Found suppliers:', rows);
            res.json(rows || []);
        });
    });

    // Create new supplier
    router.post('/', (req, res) => {
        // Convert lowercase field names to uppercase for database
        const { name: Name, contactPerson: ContactPerson, email: Email, phone: Phone } = req.body;
        
        if (!Name) {
            return res.status(400).json({ error: 'Supplier name is required' });
        }

        db.run(
            'INSERT INTO Supplier (Name, ContactPerson, Email, Phone) VALUES (?, ?, ?, ?)',
            [Name, ContactPerson || null, Email || null, Phone || null],
            function(err) {
                if (err) {
                    console.error('Error creating supplier:', err);
                    res.status(500).json({ error: 'Failed to create supplier' });
                    return;
                }
                
                // Return the created supplier with its ID
                db.get(
                    'SELECT SupplierID, Name, ContactPerson, Email, Phone FROM Supplier WHERE SupplierID = ?',
                    [this.lastID],
                    (err, row) => {
                        if (err) {
                            console.error('Error fetching created supplier:', err);
                            res.status(500).json({ error: 'Supplier created but failed to fetch details' });
                            return;
                        }
                        res.status(201).json(row);
                    }
                );
            }
        );
    });

    // Get supplier by ID
    router.get('/:id', (req, res) => {
        const supplierId = req.params.id;
        
        db.get(
            'SELECT SupplierID, Name, ContactPerson, Email, Phone FROM Supplier WHERE SupplierID = ?',
            [supplierId],
            (err, row) => {
                if (err) {
                    console.error('Error fetching supplier:', err);
                    res.status(500).json({ error: 'Failed to fetch supplier' });
                    return;
                }
                if (!row) {
                    res.status(404).json({ error: 'Supplier not found' });
                    return;
                }
                res.json(row);
            }
        );
    });

    // Update supplier
    router.put('/:id', (req, res) => {
        const supplierId = req.params.id;
        // Convert lowercase field names to uppercase for database
        const { name: Name, contactPerson: ContactPerson, email: Email, phone: Phone } = req.body;
        
        if (!Name) {
            return res.status(400).json({ error: 'Supplier name is required' });
        }

        db.run(
            'UPDATE Supplier SET Name = ?, ContactPerson = ?, Email = ?, Phone = ? WHERE SupplierID = ?',
            [Name, ContactPerson || null, Email || null, Phone || null, supplierId],
            function(err) {
                if (err) {
                    console.error('Error updating supplier:', err);
                    res.status(500).json({ error: 'Failed to update supplier' });
                    return;
                }
                if (this.changes === 0) {
                    res.status(404).json({ error: 'Supplier not found' });
                    return;
                }
                
                // Return the updated supplier
                db.get(
                    'SELECT SupplierID, Name, ContactPerson, Email, Phone FROM Supplier WHERE SupplierID = ?',
                    [supplierId],
                    (err, row) => {
                        if (err) {
                            console.error('Error fetching updated supplier:', err);
                            res.status(500).json({ error: 'Supplier updated but failed to fetch details' });
                            return;
                        }
                        res.json(row);
                    }
                );
            }
        );
    });

    // Delete supplier
    router.delete('/:id', (req, res) => {
        const supplierId = req.params.id;
        
        db.run('DELETE FROM Supplier WHERE SupplierID = ?', [supplierId], function(err) {
            if (err) {
                console.error('Error deleting supplier:', err);
                res.status(500).json({ error: 'Failed to delete supplier' });
                return;
            }
            if (this.changes === 0) {
                res.status(404).json({ error: 'Supplier not found' });
                return;
            }
            res.json({ message: 'Supplier deleted successfully' });
        });
    });

    return router;
}

module.exports = createRouter;
