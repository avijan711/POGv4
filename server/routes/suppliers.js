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
        db.all('SELECT supplier_id, name, contact_person, email, phone FROM supplier ORDER BY name', [], (err, rows) => {
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
        const { name, contactPerson, email, phone } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Supplier name is required' });
        }

        db.run(
            'INSERT INTO supplier (name, contact_person, email, phone) VALUES (?, ?, ?, ?)',
            [name, contactPerson || null, email || null, phone || null],
            function(err) {
                if (err) {
                    console.error('Error creating supplier:', err);
                    res.status(500).json({ error: 'Failed to create supplier' });
                    return;
                }
                
                // Return the created supplier with its ID
                db.get(
                    'SELECT supplier_id, name, contact_person, email, phone FROM supplier WHERE supplier_id = ?',
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
            'SELECT supplier_id, name, contact_person, email, phone FROM supplier WHERE supplier_id = ?',
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
        const { name, contactPerson, email, phone } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Supplier name is required' });
        }

        db.run(
            'UPDATE supplier SET name = ?, contact_person = ?, email = ?, phone = ? WHERE supplier_id = ?',
            [name, contactPerson || null, email || null, phone || null, supplierId],
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
                    'SELECT supplier_id, name, contact_person, email, phone FROM supplier WHERE supplier_id = ?',
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
        
        db.run('DELETE FROM supplier WHERE supplier_id = ?', [supplierId], function(err) {
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
