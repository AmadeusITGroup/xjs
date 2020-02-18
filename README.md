# XJS

XJS is a templating language that allows to mix XML elements within TypeScript files.
The main difference between XJS and JSX is that **XJS considers XML elements as statements** whereas **JSX considers them as expressions** - which means for instance that in XJS control statements can be mixed with XML statements, like in this example:

![loops](doc/imgs/loops.png?raw=true)

Main benefits:
- JS mental model: templates as JS **functions** (like JSX) -> simple learning curve, no hack
- support of template **components** (elements prefixed with *)
- explicit declaration of **text nodes** that allow for precise white space control and easy interaction with JS statements (cf. # elements)
- support of (explicit) **decorators** (aka. directives in the angular world)
- **one-time binding** expressions
- clear **property / attribute** distinction
- advanced component attribute system (including **param nodes**)
- consistent expressions
- a string-based template syntax (aka. ***xtr***) to describe static (and safe) content that should be inserted dynamically (e.g. CMS content)

The current repository contains the following items:
- a visual studio code extension to support code highlighting
- the XJS textmate grammar ([generated][build] as a super-set of the TypeScript grammar)
- [XJS][xjs-ex] and [XTR][xtr-ex] examples
- the [XJS][xjs-doc] and [XTR][xtr-doc] grammar documentations
- an [XJS parser][xjs-api]
- [XTR utilities][xtr-api] (AST and parser)
- an XTR [@@extract][xtr-extract] plugin to extract and highlight code from a given file

[xjs-ex]: examples/xjs-sample.ts
[xtr-ex]: examples/xtr-sample.ts
[xjs-doc]: doc/xjs.md
[xtr-doc]: doc/xtr.md
[xjs-api]: doc/xjs-api.md
[xtr-api]: doc/xtr-api.md
[xtr-extract]: doc/xtr-extract.md


## Deploying the visual studio extension

The visual studio highlighting extension is not deployed in the vs-code store yet - so you need to install it manually.

For this you simply need to copy the current repository to the following folder:
- On Windows: %USERPROFILE%\.vscode\extensions
- On MacOS/Linux: $HOME/.vscode/extensions 

... or simply run `bash generate-and-deploy.bash` from the project root folder (this will build the grammar and copy the necessary files to the vscode extensions folder).

Note: you will need to restart visual studio code (more options [here][build])

[build]: doc/build