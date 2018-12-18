## Reference Matching

## Matching Text Col to Image Listing

This program tries to match the QWB references (= scroll_data.name and col_data.name) with the IAA image references (= edition_catalog).  The program is run with `node align-catalog-nums.js`.  It will produce a csv file `QWB_IAA-cols.csv` with the col_id and corresponding edition_catalog_id, which can be imported into the database and used as a lookup table.  

For debugging, it exports two JSON files: a listing in `QWB_cols-discrete.json` of all discretely parsed references for the textual scroll/col ids (the top level keys are the scroll_id, which contain an array of objects for each col_id); and a listing in `IAA-discrete.json` containing all the discretely parsed entries in edition_catalog with the top level keys being the scroll_id, which each contain all edition_catalog_id's (ed_id) beloinging to it.

Note: Currently the tool does not import any data into the database, it only provides a CSV file `QWB_IAA-cols.csv` that can be imported manually into a database table.

## Matching Edition Catalog to Scroll ids

The IAA and QWB scroll names do not always match.  In order for the most basic links to be made this initial linking must be done.  This can be done by running `node link-scroll-ids.js`.  It should be safe to run this even if the links have already been created.

You can find all scrolls that could not be linked with:

```sql
SELECT distinct	manuscript, name 
FROM edition_catalog 
LEFT JOIN scroll_data ON scroll_data.name = edition_catalog.manuscript
WHERE name IS NULL
```