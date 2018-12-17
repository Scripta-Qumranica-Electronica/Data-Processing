# IAA Catalogue Import

The tools here provide functionality for importing the IAA's csv data from the Menorah database into the SQE database.  There are two components: the parser program, which is run using `node parse-catalog.js`; and the database import program.

## Parser Program

This is the parser for reading in the IAA's csv data from the Menorh database.  The program is run using `node parse-catalog.js`.

The parser reads data from the TSV formatted file `Fragment-on-plate-to-DJD-27042017.txt` in the Data folder and parses it into a `write.json`, which stores the edited data in a form that is ready for insertion into the SQE database.  The file `manual-refs.json` in the Data folder acts as a manual override, if a reference is listed in that file, it will be directly inserted into `write.json` in place of what the automated parser would have provided.

The parser also tries to provide some helpful debugging output in the `Debugging` folder.  It provides a list of patterns that it could not successfully parse in the `failed-patterns.json`.  It gives a full listing of the references it could not match in the `failed.json` file.  And it gives a listing of parsed references that it believes might be incorrect in the `problems.json` file.

The parser works using three javascript files.  The main controll logic is in the `parse-catalog.js` file.  That files uses `reference-expansion.js` to compound references like fragment 1+2, or pl. 1 frg.2 + pl. 2 frg. 2 and split them into separate discrete references.  The functions in `parsers.js` provide the logic for processing each different reference type: DJD, BE, PHLS, etc. `reference-expansion.js` will use `parsers.js` to recursively to parse the compound references.

## The Database Import Program