ALTER TABLE salespeople ADD COLUMN user_id uuid REFERENCES auth.users(id);
CREATE INDEX idx_salespeople_user_id ON salespeople(user_id);