
# @@extract

@@extract is an [XTR pre-processor][XTR api] that extracts and highlights fragments of typescript files before injecting
the resulting HTML in the XTR node on which it is sits.

```js
<! @@extract="resources/sample1.ts#sectionA" />
```

@@extract only takes one string argument that is composed of
- the relative path to the file containing the section to extract
- the name of the section (separated by a # sign)

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
- @@extract uses the fileId parameter from the [xtr parser context][XTR api] - so it must not be left empty
- @@extract can only be used as a compilation pre-processor (and not as a runtime pre-processor) - cf. ivy implementation for a practical example.

More examples can be found in [xtr.extract.spec][]


[XTR api]: ./xtr-api.md
[xtr.extract.spec]: ../src/test/xtr.extract.spec.ts
