#!/usr/bin/perl -w
use strict;
use warnings;
use File::Find;
use File::Path qw(make_path);
use Image::ExifTool;

print 'Starting:'  . "\n";
my $image_file_type = "jpg"; #Change this to search for other file types, like tiff

my $dir = $ARGV[0] ? $ARGV[0] : "";
my $outdir = $ARGV[1] ? $ARGV[1] : $dir . "ptif/";

if (! -e $dir and ! -d $dir) {
    print "\"" . $dir . "\" is not a valid directory!\n";
    print "Please type a valid directory:\n";
    print "perl parse-iaa-images.pl /Users/user/images\n";
    exit;
}

if (! -e $outdir and ! -d $outdir) {
  make_path($outdir);
}

my $exifTool = new Image::ExifTool;
my @tagList = qw(FileName ExifImageHeight ExifImageWidth XResolution YResolution);
find(\&wanted, $dir);
sub wanted {
  if($_ =~ m/.*\.$image_file_type$/) {
    my $infile = $dir . $_;
    my @outname = split /\./, $_;
    my $outfile = $outdir . $outname[0] . ".tif";
    if (! -e $outfile){
      my $cmd1 = "vips tiffsave " . $infile . " " . $outfile . " --tile --pyramid --compression jpeg --Q 94 --tile-width 256 --tile-height 256";
      print $cmd1 . "\n";
      system ($cmd1);
      my $cmd2 = "exiftool -EXIF:XResolution= -EXIF:YResolution= -EXIF:ResolutionUnit= -IPTC:All= -tagsFromFile "
      . $infile . " -EXIF:All -IFD1:All -IPTC:All -overwrite_original " . $outfile;
      print $cmd2 . "\n";
      system ($cmd2);
    } else {
      print "File exists!\n";
    }
  }
}

print "The generated ptif files have been saved to: " . $dir;