# Import Artefact Masks

The artefact masks are stored in the `Data` folder as individual GeoJSON files with a name matching the image file they should be applied to (with a .json extension instead of .tif).

## Import Masks Program

The program is run with `go run import-geojson.go`.  The folder of GeoJSON masks is hardcoded at line 47: `dir := "./Data/No-japanese-paper-10-18/"`.  It provides debugging information about masks it could not load in `Failed-import.txt`, the import fails when a corresponding filename could not be found in the database.

## Position Artefacts

The program simply grabs every artefact in a scroll_version and positions them so that none are overlapping.  This is useful for providing a workspace where all artefacts can be seen by the end user, and meaningful ROI's can already be created without needing to move the artefacts apart first.  The program is run with `python3 set-artefact-positions.py`.