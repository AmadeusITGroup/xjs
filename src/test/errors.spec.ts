import * as assert from 'assert';
import { parse } from '../parser/xjs-parser';
import { XjsError } from '../parser/types';

describe('Parsing errors', () => {

    let err = {
        // this api allows to trigger the vs-code text mate completion
        async template(tpl: string) {
            try {
                await parse(tpl);
            } catch (err) {
                if (err.kind === "#xjsError") {
                    let e = err as XjsError;
                    return `Invalid ${e.context} - ${e.message} at line ${e.lineNumber}`;
                }
                return "Non-xjs error: " + err.message;
            }
            return 'ok';
        }
    }

    it("should be raised for invalid template functions", async function () {
        assert.equal(
            await err.template(``),
            "Invalid template function - Empty template at line 1",
            "1");

        assert.equal(
            await err.template(`<div/>`),
            "Invalid template function - Invalid arrow function at line 1",
            "2");

        assert.equal(
            await err.template(`(a, b) {
            }`),
            "Invalid template function - Invalid arrow function at line 1",
            "3");

        assert.equal(
            await err.template(`(a b) => {
            }`),
            "Invalid template params - Unexpected token 'b' at line 1",
            "4");

        assert.equal(
            await err.template(`(a, b::string) => {
            }`),
            "Invalid template params - Unexpected token ':' at line 1",
            "5");

        assert.equal(
            await err.template(`(a, b) => 
                let x=3;
            }`),
            "Invalid template content - Invalid JS Block at line 2",
            "6");

        assert.equal(
            await err.template(`(a, b) => 
            }`),
            "Invalid template content - Invalid JS Block at line 2",
            "7");

        assert.equal(
            await err.template(`  `),
            "Invalid template function - Empty template at line 1",
            "8");
    });

    xit("should be raised for invalid elements", async function () {
        assert.equal(
            await err.template(`() => {
                <d.d/>
            }`),
            "Invalid template element - xx at line 2",
            "1");
    });


});
