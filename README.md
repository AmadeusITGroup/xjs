<div align="center">
  <a href="https://codecov.io/gh/AmadeusITGroup/xjs?branch=master">
    <img src="https://codecov.io/gh/AmadeusITGroup/xjs/branch/master/graphs/badge.svg?branch=master" alt="Codecov" />
  </a>
</div>

# XJS

[XJS][xjs-doc] is a template language that allows to mix XML elements in TypeScript files. XJS was designed as an improvement of React [JSX][], combining the best of JSX with interesting features from other template engines.

![loops](docs/imgs/loops.png?raw=true)

Key features:
- like JSX, XJS considers XML elements as language shortcuts (aka. DSL) that can be directly translated into JavaScript (e.g. ```<div>``` means ```createElement("div",...)```)
- unlike JSX, **XJS considers XML elements and text nodes as statements** (whereas JSX considers them as expressions) - which means for instance that JavaScript control statements can be used in XJS templates.
- XJS introduces the notion of **decorators** (also known as **directives** in many frameworks)
- XJS introduces the notion of **param nodes** to support advanced component API use cases (param nodes can be seen as [slots][] on steroids)
- like JSX, XJS relies on **JavaScript imports** to manage components and libraries
- XJS supports **pre-processors** that allow to modify a template at build time (e.g. to transform markdown text or inject content from another file)
- XJS comes with a **VS-code extension** to support proper syntax highlighting
- XJS is designed to play well with **typescript**
- XJS supports 2 kinds of templates:
    - $template strings to define parametric templates and components. $template strings have to be transformed into JavaScript at build time (like JSX) - note: this is the responsibility of the template engine that uses JSX (not provided in this repository)
    - $fragment strings to define content views that will be loaded dynamically. $fragment strings will be parsed and interpreted dynamically at runtime and can thus be built dynamically (e.g. from dynamic content retrieved from the server-side).
- In a general manner, the design of XJS is based on the [principle of least astonishment][POLA] and tries to leverage as much as possible existing JavaScript concepts to keep the learning curve as flat as possible.

Note: XJS is only **a syntax, a grammar and a parser**. It must be complemented with a code generator and and template engine runtime (like [ivy][]) to be used in actual web applications.

The current repository contains the following items:
- the [XJS][xjs-doc] syntax documentations
- [$template][] and [$fragment][] examples
- the [XJS parser][parser] documentation
- the @@extract, @@md and @@ts [pre-processors][] documentation
- the visual studio code extension to support code highlighting
- the XJS textmate grammar ([generated][build] as a super-set of the TypeScript grammar)

Full documentation [here][toc]

[JSX]: https://reactjs.org/docs/introducing-jsx.html
[slots]: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/slot
[POLA]: https://en.wikipedia.org/wiki/Principle_of_least_astonishment
[xjs-doc]: ./docs/xjs.md
[$template]: ./src/examples/template-sample.ts
[$fragment]: ./src/examples/fragment-sample.ts
[parser]: ./docs/parser.md
[pre-processors]: ./docs/pre-processors.md
[toc]: ./docs
[ivy]: https://github.com/AmadeusITGroup/ivy
[build]: ./docs/build.md


## Deploying the visual studio extension

The visual studio highlighting extension is not deployed in the vs-code store yet - so you need to install it manually.

For this you simply need to copy the current repository to the following folder:
- On Windows: %USERPROFILE%\.vscode\extensions
- On MacOS/Linux: $HOME/.vscode/extensions 

... or simply run `bash generate-and-deploy.bash` from the project root folder (this will build the grammar and copy the necessary files to the vscode extensions folder).

Note: you will need to restart visual studio code (more options [here][build])

