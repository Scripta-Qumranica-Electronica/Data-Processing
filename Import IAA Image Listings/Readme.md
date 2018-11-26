# import_iaa_iiif

This reads in in a simple .txt file containing a list of filenames provided by the NLI for images that are now available on their iiif server.  We connect to the iiif server to get the info.json file for the image, which provides its width and height. Then we parse the filename, look up the IAA plate and fragment in the SQE database.  Finally we write a new SQE_image entry from the filename.  This requires a fresh instance of the SQE database to be running locally.

Note: The NLI iiif server HTTP address is hardcoded on line 90.