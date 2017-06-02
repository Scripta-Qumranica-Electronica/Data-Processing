#!/usr/bin/perl -w
use strict;
use warnings;
use File::Find;
use DBI;
use DBI qw(:sql_types);
use Image::ExifTool;
use Image::Size;
use lib qw(/home/perl_libs);
use SQE_database;
use Data::Dumper;

my $dbh  = SQE_database::get_dbh;

print 'Starting:'  . "\n";
#my %image_data;
#my %split_images;
my $image_file_type = "tif"; #Change this to search for other file types, like tiff
my $iiif_url = "http://134.76.19.179/cgi-bin/iipsrv.fcgi";

my $dir = $ARGV[0] ? $ARGV[0] : "/var/www/html/iiif-images";
if (! -e $dir and ! -d $dir) {
    print "\"" . $dir . "\" is not a valid directory!\n";
    print "Please type a valid directory:\n";
    print "perl parse-iaa-images.pl /Users/user/images\n";
    exit;
}

my $exifTool = new Image::ExifTool;
my @tagList = qw(FileName ExifImageHeight ExifImageWidth XResolution YResolution);
find(\&wanted, $dir);
sub wanted {
  if (!-d $_) {
    #Process IAA images
    if($_ =~ m/^P.*$image_file_type$/) {
      #Image data
      my $info = $exifTool->ImageInfo($File::Find::name, @tagList);
      my $dpi = $$info{XResolution};
      my $name = $$info{FileName};
      my ($width, $height) = imgsize($dir . $name);
      print "Parsing: " . $name . "\n";

      #Data from filename
      my @subStr = split /-/, $_;
      my $plate = $subStr[0];
  		$plate =~ s/^P//g;
      my $fragment = $subStr[1];
  		$fragment =~ s/^Fg//g;
      $fragment =~ s/^0+//;
      my $side = $subStr[2];
      my $date = substr($subStr[5], 1);
      my $time = substr($subStr[6], 1);
      my $type = $subStr[7];
  		$type =~ s/__(.*)$//g;
      my $master = $type =~ /LR445/ && $side =~ /R/ ? 1 : 0;

      if ($side eq 'R'){ #Side is a boolean 0=Recto, 1=Verso.
        $side = 0;
      } else {
        $side = 1;
      }

      if ($type =~ /LR445/) { #We will probably need a legend for types, 0=color, 1=IR, 2 and 3 are raking light.
        $type = 0;
      } elsif ($type =~ /RLIR/) {
        $type = 2;
      } elsif ($type =~ /RRIR/){
        $type = 3;
      } else {
        $type = 1;
      }
      
      #We find the catalog_id and edition_id of the plate and fragment.
      my $sth = $dbh->prepare('CALL getCatalogAndEdition(?,?,?);')
          or die "Couldn't prepare statement: " . $dbh->errstr;
      $sth->execute($plate, $fragment, $side);
      my $catalogInfo = $sth->fetchall_arrayref({});
      my $imageCatalogID;
      my $editionCatalogID;
      if (@{$catalogInfo}[0]->{image_catalog_id}){
        $imageCatalogID = @{$catalogInfo}[0]->{image_catalog_id};
      }
      if (@{$catalogInfo}[0]->{edition_catalog_id}){
        $editionCatalogID = @{$catalogInfo}[0]->{edition_catalog_id};
      }

      if ($imageCatalogID && $editionCatalogID) {
        print ($imageCatalogID . " " . $editionCatalogID . "\n");
      }
      # my $platefragUID;
      # while (my @data = $sth->fetchrow_array()) {
      #   $platefragUID = $data[0];
      # }

      #We insert the record if it doesn't already exist, the URL is unique.
      # $sth = $dbh->prepare('INSERT IGNORE INTO SQE_image (url, native_width, native_height, dpi, type, catalogue_id, is_master) VALUES (?, ?, ?, ?, ?, ?, ?)')
      #   or die "Couldn't prepare statement: " . $dbh->errstr;
      # $sth->execute('http://134.76.19.179/cgi-bin/iipsrv.fcgi?IIIF=' . $name,
      #               $width, $height, $dpi, $type, $platefragUID, $master);
    }

    if($_ =~ m/^M.*$image_file_type$/) {
      #Image data
      my $info = $exifTool->ImageInfo($File::Find::name, @tagList);
      my $dpi = 0;
      my $name = $$info{FileName};
      print "Parsing: " . $name . "\n";
      my ($width, $height) = imgsize($dir . $name);

      #Data from filename
      my @id_data = split /-/, $_;
      my $series = substr($id_data[0], 1, 2);
      my $number = substr($id_data[0], 3);
      my $side = 0; # Always recto, which = 0
      my $type = 1; # Always grayscale, which = 1
      my $master = 0; # Never master, so always 0
      my $institution = "PAM";
      print ("Add entry: " . $institution . ", series: " . $series . ", number: " . $number . ", side: " . $side . ".\n");
    }
  }
}

$dbh->disconnect();

