const express = require('express');
const cors = require('cors');
const SupplierModel = require('../models/supplier');
const { DatabaseAccessLayer } = require('../config/database');

function createRouter({ db }) {
  const router = express.Router();
  const supplierModel = new SupplierModel(db instanceof DatabaseAccessLayer ? db : new DatabaseAccessLayer(db));

  // Enable CORS
  router.use(cors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }));

  // Get all suppliers
  router.get('/', async (req, res) => {
    try {
      console.log('Fetching suppliers');
      const suppliers = await supplierModel.getAllSuppliers();
      console.log('Found suppliers:', suppliers);
      res.json(suppliers || []);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
      res.status(500).json({ error: 'Failed to fetch suppliers' });
    }
  });

  // Create new supplier
  router.post('/', async (req, res) => {
    try {
      const { name, contactPerson, email, phone } = req.body;
            
      if (!name) {
        return res.status(400).json({ error: 'Supplier name is required' });
      }

      const supplier = await supplierModel.createSupplier({
        name,
        contactPerson,
        email,
        phone,
      });
            
      res.status(201).json(supplier);
    } catch (err) {
      console.error('Error creating supplier:', err);
      res.status(500).json({ error: 'Failed to create supplier' });
    }
  });

  // Get supplier by ID
  router.get('/:id', async (req, res) => {
    try {
      const supplier = await supplierModel.getSupplierById(req.params.id);
      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }
      res.json(supplier);
    } catch (err) {
      console.error('Error fetching supplier:', err);
      res.status(500).json({ error: 'Failed to fetch supplier' });
    }
  });

  // Update supplier
  router.put('/:id', async (req, res) => {
    try {
      const { name, contactPerson, email, phone } = req.body;
            
      if (!name) {
        return res.status(400).json({ error: 'Supplier name is required' });
      }

      const supplier = await supplierModel.updateSupplier(req.params.id, {
        name,
        contactPerson,
        email,
        phone,
      });

      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }
            
      res.json(supplier);
    } catch (err) {
      console.error('Error updating supplier:', err);
      res.status(500).json({ error: 'Failed to update supplier' });
    }
  });

  // Delete supplier
  router.delete('/:id', async (req, res) => {
    try {
      const result = await supplierModel.deleteSupplier(req.params.id);
      if (!result.deleted) {
        return res.status(404).json({ error: 'Supplier not found' });
      }
      res.json({ message: 'Supplier deleted successfully' });
    } catch (err) {
      console.error('Error deleting supplier:', err);
      res.status(500).json({ error: 'Failed to delete supplier' });
    }
  });

  return router;
}

module.exports = createRouter;
