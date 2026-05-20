-- Food cache: stores FatSecret results so repeated searches are instant and free
CREATE TABLE IF NOT EXISTS food_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  food_id TEXT UNIQUE NOT NULL,
  food_name TEXT NOT NULL,
  brand_name TEXT,
  serving_description TEXT,
  calories NUMERIC,
  protein NUMERIC,
  carbs NUMERIC,
  fat NUMERIC,
  fiber NUMERIC,
  sugar NUMERIC,
  source TEXT DEFAULT 'fatsecret',
  search_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_searched_at TIMESTAMPTZ DEFAULT NOW()
);

-- Full-text search index on food_name
CREATE INDEX IF NOT EXISTS food_cache_name_idx
  ON food_cache USING gin(to_tsvector('english', food_name));

-- Fast lookup by food_id
CREATE INDEX IF NOT EXISTS food_cache_food_id_idx
  ON food_cache(food_id);

-- RLS
ALTER TABLE food_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read food cache"
  ON food_cache FOR SELECT USING (true);

CREATE POLICY "Service role can insert food cache"
  ON food_cache FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update food cache"
  ON food_cache FOR UPDATE USING (true);
