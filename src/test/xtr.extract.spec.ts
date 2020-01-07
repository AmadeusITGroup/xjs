import * as assert from 'assert';
import { extract } from '../xtr/extract';
import { join } from 'path';
import { XtrParserContext, parse } from '../xtr/parser';
import { xtr } from '../xtr/xtr';

describe('XTR extract pre-processor', () => {

    const context: XtrParserContext = { preProcessors: { "@@extract": extract }, fileId: join(__dirname, "xtr.extract.spec.ts") };

    async function transform(xtr: string, context: XtrParserContext) {
        return (await parse(xtr, context)).toString();
    }

    it("should extract sections in the middle of a file", async function () {
        assert.deepEqual(await transform(xtr`
            AA
            <! @@extract="resources/sample1.ts#sectionA" />
            BB
        `, context), '\n AA \n<!>function foo() {\n    return "bar";\n}\n\n</!>\n BB \n', '1');
    });

    it("should extract sections at the end or a file", async function () {
        assert.deepEqual(await transform(xtr`
            <span> BEGINNING </span>
            <div @@extract="./resources/sample1.ts#sectionC" />
            <div> abc </>
            <span> END </span>
        `, context), '\n<span> BEGINNING </span>\n<div>class TheClass {\n    method() {\n        return 123;\n    }\n}\n</div>\n<div> abc </div>\n<span> END </span>\n', '1');
    });

    const padding = '                ';
    async function error(xtr: string) {
        try {
            await transform(xtr, context);
        } catch (err) {
            return "\n" + padding + err.replace(/\n/g, "\n" + padding)
                .replace(/File\:.*/, "File: ...")
                .replace(/File doesn't exist\:.*/, "File doesn't exist: ...") + "\n" + padding;
        }
        return "NO ERROR";
    }

    it("should properly manage errors", async function () {
        assert.equal(await error(xtr`
                <div @@extract/>
            `), `
                XTR: @@extract: Invalid usage: file path must be provided
                Line 2 / Col 22
                File: ...
                Extract: >> <div @@extract/> <<
                `, "1");

        assert.equal(await error(xtr`
                <div @@extract="./resources/sample1.ts"/>
            `), `
                XTR: @@extract: Invalid file path: no section name provided
                Line 2 / Col 22
                File: ...
                Extract: >> <div @@extract="./resources/sample1.ts"/> <<
                `, "2");

        assert.equal(await error(xtr`
                <div @@extract="/resources/sample1.ts#sectionA"/>
            `), `
                XTR: @@extract: Invalid path: file path must be relative
                Line 2 / Col 22
                File: ...
                Extract: >> <div @@extract="/resources/sample1.ts#sectionA"/> <<
                `, "3");

        assert.equal(await error(xtr`
                <div @@extract="resources/sample2.ts#sectionE"/>
            `), `
                XTR: @@extract: Invalid file content: 'sectionD' is defined twice
                Line 2 / Col 22
                File: ...
                Extract: >> <div @@extract="resources/sample2.ts#sectionE"/> <<
                `, "4");

        assert.equal(await error(xtr`
                <div @@extract="resources/invalid.ts#sectionE"/>
            `), `
                XTR: @@extract: File doesn't exist: ...
                Line 2 / Col 22
                File: ...
                Extract: >> <div @@extract="resources/invalid.ts#sectionE"/> <<
                `, "5");

        assert.equal(await error(xtr`
                <div @@extract="resources/sample1.ts#sectionE"/>
            `), `
                XTR: @@extract: Invalid section: 'sectionE' is not defined
                Line 2 / Col 22
                File: ...
                Extract: >> <div @@extract="resources/sample1.ts#sectionE"/> <<
                `, "6");

        assert.equal(await error(xtr`
                <*cpt @@extract="resources/sample1.ts#sectionA"/>
            `), `
                XTR: @@extract: Only elements and fragments can be used as host
                Line 2 / Col 22
                File: ...
                Extract: >> <*cpt @@extract="resources/sample1.ts#sectionA"/> <<
                `, "7");

        assert.equal(await error(xtr`
                <div @@extract="resources/sample1.ts#sectionA">
                    Hello world
                </div>
            `), `
                XTR: @@extract: Host cannot contain child elements
                Line 2 / Col 21
                File: ...
                Extract: >> <div @@extract="resources/sample1.ts#sectionA"> <<
                `, "8");
    });

});

