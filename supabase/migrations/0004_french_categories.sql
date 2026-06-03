-- Replace the English-language seed with the 16 French categories that the
-- LLM prompt actually returns. The old seed caused matchCategory() to silently
-- fail on every scanned item because "Yaourt" never substring-matches "Yogurt".
--
-- pantry_items.category_id is ON DELETE SET NULL, so existing rows lose their
-- binding here and get re-categorised on next scan / manual edit.

delete from item_categories;

-- Reset the auto-increment so the new ids start clean.
alter sequence item_categories_id_seq restart with 1;

insert into item_categories (name, default_shelf_life_days, icon, locale_aliases) values
  ('Lait',            7,   'milk',         array['lait','milk']),
  ('Yaourt',          14,  'milk',         array['yaourt','yogurt','skyr','brasse']),
  ('Fromage (dur)',   30,  'cheese',       array['fromage','cheese','comte','gruyere','parmesan']),
  ('Fromage (mou)',   10,  'cheese',       array['brie','camembert','mozzarella','burrata','feta','chevre']),
  ('Œufs',            21,  'egg',          array['oeufs','œufs','eggs','oeuf']),
  ('Pain',            5,   'bread',        array['pain','bread','baguette']),
  ('Viande fraîche',  3,   'beef',         array['viande','poulet','boeuf','porc','agneau','meat']),
  ('Poisson frais',   2,   'fish',         array['poisson','saumon','thon frais','cabillaud']),
  ('Légumes feuilles',5,   'leaf',         array['salade','epinards','laitue','roquette']),
  ('Fruits tendres',  5,   'apple',        array['fraises','framboises','peche','myrtilles','banane']),
  ('Fruits fermes',   14,  'apple',        array['pomme','orange','citron','poire','kiwi']),
  ('Légumes',         10,  'carrot',       array['carotte','tomate','courgette','poireau','oignon']),
  ('Conserves',       720, 'package',      array['conserve','boite','thon','pulpe']),
  ('Surgelés',        180, 'snowflake',    array['surgele','glace','ravioli']),
  ('Épicerie sèche',  365, 'package',      array['riz','pates','farine','sucre','sel','huile','cafe']),
  ('Autre',           14,  'package',      array[]::text[]);
