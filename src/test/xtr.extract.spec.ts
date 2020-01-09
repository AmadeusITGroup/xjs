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

    function format(s: string) {
        return s.replace(/\n/g, "\n            ");
    }

    it("should extract sections in the middle of a file", async function () {
        assert.deepEqual(format(await transform(xtr`
            AA
            <! @@extract="resources/sample1.ts#sectionA" />
            BB
        `, context)), `
             AA 
            <!>
              <div class='extract ts'>
                <div>
                  <span class='hr'>function</span>
                   
                  <span class='hf'>foo</span>
                  () {
                </>
                <div>
                      
                  <span class='hc'>!/!/ comment with !<span></span>
                </>
                <div>
                      
                  <span class='hk'>return</span>
                   
                  <span class='hs'>"bar"</span>
                  ;
                </>
                <div>}</div>
                <div> </div>
              </>
            </>
             BB 
            `, '1');
    });

    it("should extract sections at the end or a file", async function () {
        assert.deepEqual(format(await transform(xtr`
            <span> BEGINNING </span>
            <div @@extract="./resources/sample1.ts#sectionC" />
            <div> abc </>
            <span> END </span>
        `, context)), `
            <span> BEGINNING </span>
            <div>
              <div class='extract ts'>
                <div>
                  <span class='hr'>class</span>
                   
                  <span class='ht'>TheClass</span>
                   {
                </>
                <div>
                      
                  <span class='hf'>method</span>
                  () {
                </>
                <div>
                          
                  <span class='hk'>return</span>
                   
                  <span class='hn'>123</span>
                  ;
                </>
                <div>    }</div>
                <div>}</div>
                <div> </div>
              </>
            </>
            <div> abc </div>
            <span> END </span>
            `, '1');
    });

    const padding = '                ';
    async function error(xtr: string) {
        try {
            await transform(xtr, context);
        } catch (err) {
            return "\n" + padding + err.replace(/\n/g, "\n" + padding)
                .replace(/File\:.*/, "File: ...")
                .replace(/File not found\:.*/, "File not found: ...") + "\n" + padding;
        }
        return "NO ERROR";
    }

    it("should support template highlighting", async function () {
        assert.deepEqual(format(await transform(xtr`
            <div @@extract="./resources/sample3.ts#template-section" />
        `, context)), `
            <div>
              <div class='extract ts'>
                <div>
                  <span class='hr'>interface</span>
                   
                  <span class='ht'>IFoo</span>
                   {
                </>
                <div>
                      
                  <span class='hv'>x</span>
                  <span class='hk'>:</span>
                   
                  <span class='hy'>boolean</span>
                  ;
                </>
                <div>}</div>
                <div>
                  <span class='hr'>const</span>
                   
                  <span class='hv'>tpl</span>
                   
                  <span class='hk'>=</span>
                   
                  <span class='hf'>template</span>
                  (\`(
                  <span class='hv'>a</span>
                  <span class='hk'>:</span>
                  <span class='hy'>string</span>
                  ) 
                  <span class='hr'>=></span>
                   {
                </>
                <div>
                      
                  <span class='hp'>!<</span>
                  <span class='hg'>div</span>
                   
                  <span class='ho'>class</span>
                  <span class='hk'>=</span>
                  <span class='hs'>"abc"</span>
                  <span class='hp'>></span>
                  <span class='hs'>
                     # text 
                    <span class='hd'>{</span>
                    <span class='hv'>a</span>
                    <span class='hd'>}</span>
                     #
                  </>
                   
                  <span class='hp'>!<</span>
                  <span class='hp'>!/</span>
                  <span class='hp'>></span>
                </>
                <div>}\`);</div>
                <div> </div>
              </>
            </>
            `, '1');
    });

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
                XTR: @@extract: File not found: ...
                Line 2 / Col 22
                File: ...
                Extract: >> <div @@extract="resources/invalid.ts#sectionE"/> <<
                `, "5");

        assert.equal(await error(xtr`
                <div @@extract="resources/sample1.ts#sectionE"/>
            `), `
                XTR: @@extract: Section not found: 'sectionE'
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

        assert.equal(await error(xtr`
                <div @@extract="resources/sample1.ts#section@#$"/>
            `), `
                XTR: @@extract: Invalid section name: 'section@#$'
                Line 2 / Col 22
                File: ...
                Extract: >> <div @@extract="resources/sample1.ts#section@#$"/> <<
                `, "9");
    });

});

