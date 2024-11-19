const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('inventory.db');

// Test inserting a promotion with non-existent items
db.serialize(() => {
  db.run('INSERT INTO promotions (name, supplier_id, start_date, end_date) VALUES (?, ?, ?, ?)', 
    ['Test Promotion', 1, '2024-01-01', '2024-12-31'], 
    function(err) {
      if (err) {
        console.error('Error creating promotion:', err);
        return;
      }
      const promotionId = this.lastID;
      
      // Try to insert items that don't exist in Item table
      db.run('INSERT INTO promotion_items (promotion_id, item_id, promotion_price) VALUES (?, ?, ?)',
        [promotionId, 'TEST123', 99.99],
        (err) => {
          if (err) {
            console.error('Error inserting promotion item:', err);
          } else {
            console.log('Successfully inserted promotion item without inventory dependency');
          }
          db.close();
        }
      );
    }
  );
});
