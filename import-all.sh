#!/bin/bash

cd Import_IAA_Catalog_Listings
yarn load

cd ../Import_IAA_IIIF_Image_Listings
node manual-add-listing.js -f manual-data/4Q259-additions.csv
python3 import_iaa_iiif.py -i NLI-IAA-data/newlist22.11.18.csv -d SQE_DEV

cd ../Reference_Matching
node link-scroll-ids.js
node create-owner-tables.js
yarn parse
node load-matches

cd ../Import_TA_Artefact_Mask_Polygons
go run import-geojson.go
python3 set-artefact-positions.py