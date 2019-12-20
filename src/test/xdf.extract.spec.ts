import * as assert from 'assert';
import { extract } from '../xdf/extract';
import { join } from 'path';
import { json } from '../xdf/json';
import { XdfParserContext } from '../xdf/parser';

describe('XDF extract pre-processor', () => {

    const context: XdfParserContext = { preProcessors: { "@@extract": extract }, fileId: join(__dirname, "xdf.extract.spec.ts") };

    it("should extract sections in the middle of a file", async function () {
        assert.deepEqual(await json(`
            AA
            <! @@extract="resources/sample1.ts#sectionA" />
            BB
        `, context), {
            content: "AA function foo() {\n    return \"bar\";\n}\n\n BB"
        }, '1');
    });

    it("should extract sections at the end or a file", async function () {
        assert.deepEqual(await json(`
            <span> BEGINNING </span>
            <div @@extract="./resources/sample1.ts#sectionC" />
            <div> abc </>
            <span> END </span>
        `, context), {
            content: "<span> BEGINNING </><div>class TheClass {\n    method() {\n        return 123;\n    }\n}\n</><div> abc </><span> END </>"
        }, '1');
    });

    const padding = '                ';
    async function error(xdf: string) {
        try {
            await json(xdf, context);
        } catch (err) {
            return "\n" + padding + err.replace(/\n/g, "\n" + padding).replace(/File\:.*/, "File: ...") + "\n" + padding;
        }
        return "NO ERROR";
    }

    it("should properly manage errors", async function () {
        assert.equal(await error(`
                <div @@extract/>
            `), `
                XDF: @@extract: Invalid usage: file path must be provided
                Line 2 / Col 22
                File: ...
                Extract: >> <div @@extract/> <<
                `, "1");

        assert.equal(await error(`
                <div @@extract="./resources/sample1.ts"/>
            `), `
                XDF: @@extract: Invalid file path: no section name provided
                Line 2 / Col 22
                File: ...
                Extract: >> <div @@extract="./resources/sample1.ts"/> <<
                `, "2");

        assert.equal(await error(`
                <div @@extract="/resources/sample1.ts#sectionA"/>
            `), `
                XDF: @@extract: Invalid path: file path must be relative
                Line 2 / Col 22
                File: ...
                Extract: >> <div @@extract="/resources/sample1.ts#sectionA"/> <<
                `, "3");

        assert.equal(await error(`
                <div @@extract="resources/sample2.ts#sectionE"/>
            `), `
                XDF: @@extract: Invalid file content: 'sectionD' is defined twice
                Line 2 / Col 22
                File: ...
                Extract: >> <div @@extract="resources/sample2.ts#sectionE"/> <<
                `, "4");

        assert.equal(await error(`
                <div @@extract="resources/invalid.ts#sectionE"/>
            `), `
                XDF: @@extract: File doesn't exist
                Line 2 / Col 22
                File: ...
                Extract: >> <div @@extract="resources/invalid.ts#sectionE"/> <<
                `, "5");

        assert.equal(await error(`
                <div @@extract="resources/sample1.ts#sectionE"/>
            `), `
                XDF: @@extract: Invalid section: 'sectionE' is not defined
                Line 2 / Col 22
                File: ...
                Extract: >> <div @@extract="resources/sample1.ts#sectionE"/> <<
                `, "6");

        assert.equal(await error(`
                <*cpt @@extract="resources/sample1.ts#sectionA"/>
            `), `
                XDF: @@extract: Only elements and fragments can be used as host
                Line 2 / Col 22
                File: ...
                Extract: >> <*cpt @@extract="resources/sample1.ts#sectionA"/> <<
                `, "7");

        assert.equal(await error(`
                <div @@extract="resources/sample1.ts#sectionA">
                    Hello world
                </div>
            `), `
                XDF: @@extract: Host cannot contain child elements
                Line 2 / Col 21
                File: ...
                Extract: >> <div @@extract="resources/sample1.ts#sectionA"> <<
                `, "8");
    });

});

