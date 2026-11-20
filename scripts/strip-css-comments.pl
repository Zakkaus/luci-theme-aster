#!/usr/bin/env perl
# Remove /* … */ comments from stylesheets, nothing else.
#
#   perl scripts/strip-css-comments.pl            stdin -> stdout
#   perl scripts/strip-css-comments.pl FILE...    in place
#
# The package build runs this on its copy of htdocs (Makefile,
# Build/Prepare/luci-theme-aster), and checks/budget.sh measures its output:
# the source keeps its comments, the router gets the stylesheets without them.
#
# A "/*" inside a quoted string or an unquoted url(…) (a data: URI) is not a
# comment, so strings and url() are matched first and kept as they are. A line
# that held only a comment goes with it, and the blank lines left behind
# collapse to one. A comment between two non-blank characters becomes "/**/":
# CSS reads a comment as a token boundary, and "1px/**/solid" without it would
# be one token. Values, selectors and whitespace inside rules are untouched.
use strict;
use warnings;

my $string = qr{"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'}s;
my $url    = qr{\burl\((?:[^)"'\\]|\\.)*\)}s;

sub strip {
	my ($css) = @_;
	die "input holds \\x01, which the stripper uses as a marker\n" if $css =~ /\x01/;
	$css =~ s{($string|$url)|/\*.*?\*/}{defined $1 ? $1 : "\x01"}gse;
	$css =~ s{^[ \t]*\x01[ \t\x01]*\n}{}gm;           # a line that was only comments
	$css =~ s{(?<=[^\s\x01])\x01+(?=[^\s\x01])}{/**/}g;  # keep a token boundary
	$css =~ s{^([ \t]*)\x01+[ \t]*}{$1}gm;            # comment before code on a line
	$css =~ s{[ \t]*\x01+}{}g;                        # comment after code on a line
	$css =~ s{\n{3,}}{\n\n}g;
	$css =~ s{\A\n+}{};
	return $css;
}

local $/;
if (!@ARGV) {
	binmode STDIN;
	binmode STDOUT;
	print strip(<STDIN>);
	exit 0;
}
for my $file (@ARGV) {
	open my $in, '<:raw', $file or die "$file: $!\n";
	my $css = <$in>;
	close $in;
	my $out = strip($css);
	next if $out eq $css;
	open my $fh, '>:raw', "$file.tmp" or die "$file.tmp: $!\n";
	print $fh $out;
	close $fh or die "$file.tmp: $!\n";
	rename "$file.tmp", $file or die "$file: $!\n";
}
