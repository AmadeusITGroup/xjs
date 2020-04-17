
# Pre-processors

On top of the [pre-processor API][] that allows to create custom pre-processors, XJS comes with 3 pre-processors that can be used out-of-the-box:
- [@@extract](#extract): to extract, inject and highlight a typescript section from another file
- [@@md markdown converter](#md-markdown-converter): to convert a markdown text into HTML
- [@@ts typescript highlighter](#ts-typescript-highlighter): to highlight some typescript text 

<small><i><a href='http://ecotrust-canada.github.io/markdown-toc/'>Table of contents generated with markdown-toc</a></i></small>


[pre-processor API]: ../parser.md#xjs-pre-processors

## @@extract 

@@extract is a pre-processor that extracts and highlights fragments of typescript files before injecting
the resulting HTML in the XJS node on which it is sits.

```html
<! @@extract="resources/sample1.ts#sectionA" />
<! @@extract(section="resources/sample1.ts#sectionB" trim=false) />
```

@@extract accepts 2 params:
- **section** (default param): a string that is composed of
    - the relative path to the file containing the section to extract
    - the name of the section (separated by a # sign)
- **trim**: a boolean that tell if the start & end empty lines should be removed (default: true)

The section name must simply be defined as a comment in the targeted file. The section will end with the beginning of a new section:
```js
// @@extract: sectionA
function foo() {
    // comment with <span>
    return "bar";
}

// @@extract: sectionB
const blah="abc";
```

Note: 
- @@extract uses the fileId parameter from the [xjs parser context][parser] - so it must not be left empty
- @@extract can only be used as a compilation pre-processor (and not as a runtime pre-processor) - cf. [ivy][] implementation for a practical example.

More examples can be found in [extract.spec][].

[parser]: ./parser.md#xjs-parser
[extract.spec]: ../src/test/pre-processors/extract.spec.ts

## @@md markdown converter

@@md is a pre-processors that converts some markdown text into XHTML tags. @md is simply a wrapper over the [marked.js][] library.
Because markdown interprets all white spaces and new line characters, @@md can only be used with \<!cdata> elements:

```html
<!cdata @@md="intro">
# Main title
## Second title
Some paragraph
</!cdata>
```

@@md will replace the \<!cdata> section with a \<div class="md"> element to allow for CSS styling.

@@md accepts only one param:
- **class** (default param): a css class name that will be appended to the generated div container (default: empty).
    e.g. for class="intro", the generated div class will be "md intro"

[marked.js]: https://marked.js.org/


## @@ts typescript highlighter

@@ts is a pre-processor that highlights typescript code with the XJS typescript grammar used by the Visual Studio Code extension ([here][grammar]). As typescript code can contain many special characters that could collide with XJS, @@ts can only be used on \<!cdata> sections:

```html
<!cdata @@ts>
    const x=123;

    function foo() {
        return null;
    }
</!cdata>
Some code: <!cdata @@ts="foo"> foo(bar, "baz"); </!cdata>
```

Like with @@md, @@ts will replace the \<!cdata> section with a container element. If the code extract doesn't contain any new line character, the container will be a \<span>, otherwise it will be a \<div>. @@ts will also set a "ts_code" CSS class to this container.

@@ts accepts 2 params:
- **class** (default param): a css class name that will be appended to the container element (default: empty).
    e.g. for \<!cdata @ts="xxx">let x=0;\</!cdata> the container will be \<span class="ts_code xxx">
- **trim**: a boolean that tell if the start & end empty lines should be removed (default: true)



[XTR api]: ./xtr-api.md
[grammar]: ./../syntaxes/xjs.tmLanguage.json
