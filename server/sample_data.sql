INSERT INTO products (name, unit_type, stock_qty, cost_price, sell_price) VALUES
  ('Spider-Man',       'A4',       40, 12.00, 30.00),
  ('Spider-Man',       'A3',       25, 25.00, 60.00),
  ('Batman',           'A4',       35, 12.00, 30.00),
  ('Batman',           'A3',       18, 25.00, 60.00),
  ('Iron Man',         'A4',       30, 12.00, 30.00),
  ('Iron Man',         'A5',       50,  6.00, 15.00),
  ('Superman',         'A4',       28, 12.00, 30.00),
  ('Superman',         'A5',       45,  6.00, 15.00),
  ('Hulk',             'A3',        8, 25.00, 60.00),
  ('Thor',             'A5',       32,  6.00, 15.00),
  ('Black Panther',    'A4',        0, 12.00, 30.00),
  ('Captain America',  'Polaroid', 60,  3.00, 10.00),
  ('Wonder Woman',     'Polaroid', 55,  3.00, 10.00),
  ('Deadpool',         'Polaroid', 70,  3.00, 10.00)
ON CONFLICT (lower(name), unit_type) DO NOTHING;
