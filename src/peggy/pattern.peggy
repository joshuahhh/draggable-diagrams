Pattern
  = "#"? _ PatternContents

PatternContents
  = "(" _ Op _ (Pattern |.., _|) _ ")"
  / $[A-Za-z0-9_]+

Op
  = $(![A-Za-z_\s()#] AnyChar) Integer?

AnyChar
  = [\uD800-\uDBFF] [\uDC00-\uDFFF]
  / .

Integer
  = x:$[0-9]+ { return Number(x) }

_  = [ \t\n\r]*
