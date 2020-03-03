# XJS

[XJS][xjs-doc] is a templating language that allows to mix XML elements in TypeScript files.
The main difference between XJS and JSX is that **XJS considers XML elements as statements** whereas **JSX considers them as expressions** - which means for instance that in XJS control statements can be mixed with XML statements, like in this example:

![loops](docs/imgs/loops.png?raw=true)

Main benefits:
- JS mental model: templates as JS **functions** (like JSX) -> simple learning curve, no hack
- advanced **components** attribute system (including **param nodes**)
- possibility to use **JavaScript control statements** ('for' loops, 'if' conditions, local variables...)
- support of **decorators** (aka. directives in the angular world)
- simple and powerful **binding** expressions
- a string-based template syntax (aka. ***xtr***) to describe static (and safe) content that should be inserted dynamically (e.g. CMS content)

Note: XJS doesn't come with a template engine (like react's JSX) and must be complemented with a template engine implementation to be used in actual web applications.

The current repository contains the following items:
- the [XJS][xjs-doc] and [XTR][xtr-doc] grammar documentations
- [XJS][xjs-ex] and [XTR][xtr-ex] examples
- a visual studio code extension to support code highlighting
- the XJS textmate grammar ([generated][build] as a super-set of the TypeScript grammar)
- an [XJS parser][xjs-api]
- [XTR utilities][xtr-api] (AST and parser)
- an XTR [@@extract][xtr-extract] plugin to extract and highlight code from a given file

Full documentation [here][toc]

[xjs-ex]: ./src/examples/xjs-sample.ts
[xtr-ex]: ./src/examples/xtr-sample.ts
[xjs-doc]: ./docs/xjs.md
[xtr-doc]: ./docs/xtr.md
[xjs-api]: ./docs/xjs-api.md
[xtr-api]: ./docs/xtr-api.md
[xtr-extract]: ./docs/xtr-extract.md
[toc]: ./docs


## Deploying the visual studio extension

The visual studio highlighting extension is not deployed in the vs-code store yet - so you need to install it manually.

For this you simply need to copy the current repository to the following folder:
- On Windows: %USERPROFILE%\.vscode\extensions
- On MacOS/Linux: $HOME/.vscode/extensions 

... or simply run `bash generate-and-deploy.bash` from the project root folder (this will build the grammar and copy the necessary files to the vscode extensions folder).

Note: you will need to restart visual studio code (more options [here][build])

[build]: ./docs/build.md