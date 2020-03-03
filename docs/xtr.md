
# XTR syntax

XTR (for Xml in sTRings) is a simplified version of [XJS][] (for Xml in JS) that is meant to be interpreted dynamically to be used as application data - for instance as JSON content retrieved from a CMS server. As such, XTR is also meant to be safe - because content could be provided by 3rd parties - and some HTML elements or attributes should be forbidden (like ```<script>``` tags for instance).

Note: the XTR *security* part is still under construction, so future versions of XTR may be more restrictive than the current implementation.

As far as syntax is concerned, here are the main differences between XTR and XJS:
- XTR is static, so JS statements cannot be used
- text nodes don't use ```#``` delimiters
- expressions can only be references and not full JS expressions (cf. below)
- XTR supports ```<!cdata>``` sections to embed content that should not be interpreted by the XTR parser
- XTR strings are usually defined in template strings and highlighting is triggered by using the 'xtr' template function (however normal strings will work as well)
- When used with the 'xtr' template function, static XTR strings can be validated at build time and can use pre-processors - for instance to include content from other files (cf. [@@extract][])

Example:
```js
import { xtr } from '../xtr/xtr';

export const contentA = xtr`
    <div>
        Hello World!
        <*section p1='someValue' #lbl>
            <.header> Header </.header>
            <.footer @deco mode={displayMode}>
                <div> Footer </div>
            </!cdata>
            This is the section <b> content </b>
        </>
    </>
`;
```

[XJS]: ./xjs.md
[@@extract]: ./xtr-extract.md

## References

XTR is meant to be interpreted within a context that will be provided by the client application. The goal of this context is to provide a list of authorized local references that can be used in the XTR string (again, XTR should be safe by design, so authorized references need to be explicitly provided by the client context).

If we consider the previous example, the client context should provide (and authorize) the following references:
- **section**: to be able to use the *section* component
- **deco**: to use the *deco* decorator
- **displayMode**: to pass the *displayMode* value to the *mode* param

As far as syntax is concerned, references must match the following pattern: ```a-z[a-zA-Z0-9_]*```

## Using XTR in XJS

For the time being XJS doesn't impose any specific syntax to bind XTR content to an element or a fragment.

However, the recommendation is to use a custom decorator for this purpose. Here is an example with the *ivy* template engine:

```js
const main = template(`(xtrValue:string) => {
    <div @xtrContent(xtr={xtrValue} resolver={xtrResolver}) />
}`);
```

where xtrResolver is a function that returns the JS references associated to a given XTR context:

```js
async function xtrResolver(ref: string): Promise<any> {
    // filter authorized references
    if (ref === "helloClass") return "blue";
    if (ref === "alert") return alert;
    console.log("UNAUTHORIZED REF: " + ref);
    return null;
}

const alert = template(`(type="", $content:IvContent, title:IvContent) => {
    <div class={"alert " + type}>
        <span class="title"> 
            if (title) {
                <! @content={title}/>
            } else {
                # Warning: #
            }
        </>
       <! @content/>
    </>
}`);
```

Note that xtrResolver is asynchronous to be able to retrieve some references asynchronously.

Behind the scene, the XJS custom decorator (i.e. ```@xtrContent``` in this example) should use the [XTR parser][] to generate (and then dynamically interpret) the XTR syntax tree.


[XTR parser]: ./xtr-api.md

## Special characters escaping

As XTR is mostly used within template strings, it is not convenient to use the standard ```\``` backslash character to escape and encode special characters - so XTR uses the ```!``` exclamation mark instead. For the time being, XTR supports only 5 special characters:
- **!s** to generate an unbreakable space
- **!n** to generate a new line character
- **!/** to generate a forward slash
- **!<** to generate a less-than sign (that will not be interpreted as the beginning of a tag)
- **!!** to generate an exclamation mark


## CDATA sections

Sometimes it comes in handy to be able to provide complex content without having to escape every single characters when they should not be interpreted as XML/HTML element (or components/fragments). This is where ```<!cdata>...</!cdata>``` sections come into play: they allow to group any XML content into a single text node.

```js
const content = xtr`
    <div>
        <span> AAA </span>
        <!cdata>cdata #1</!cdata>
    </>
    <!cdata>
        cdata #2: <section> Hello M </section>
    </!cdata>
`;
```

The only part that can be encoded in a cdata section is the *end of cdata* symbol: ```!</!cdata>```.

## Pre-processors

Last but not least, as static XTR strings can be validated at compilation time, XTR offers the possibility to support pre-processors.

Pre-processors are asynchronous transformation functions that are called by the XTR parser and that can modify the AST processed by the parser (cf. [@@extract][])

Syntactically pre-processors use the same syntax as decorators, but with the *@@* prefix:

```js
const content = xtr`
    <*cpt @@extract="./resources/sample1.ts#sectionC" />
`;
```

Note: pre-processors can also be used at run-time. In this case, they need to be provided as XTR context references.
