import { XjsParamHost, XjsParamDictionary, XjsPreProcessorCtxt, XjsParam, XjsElement, XjsContentHost } from './../xjs/types';
import { IToken } from 'vscode-textmate';
import { join, isAbsolute } from 'path';
import { promises } from 'fs';
import { tokenize, appendHighlightElts } from './ts';
import { addParam, createParam, createElement, addContent } from '../xjs/parser';

interface Section {
    lineIdx: number;    // index of first line
    nbrOfLines: number;
    nextSectionName: string;
}

interface SectionDict {
    lines: string[];
    tokens?: IToken[][];
    sections: Section[];
}

const U = undefined,
    RX_CR = /\n/,
    RX_FILE_NAME = /[^\/]+$/,
    RX_FILE_EXT = /\.([^\.]+)$/,
    RX_SECTION_DEF = /^\s*\/\/\s*@@extract\:\s*(\w[\w\$\-]*)( .*)?$/,
    RX_SECTION_REFS = /^([^\>]+)\>\>([^\>]+)$/,
    RX_SECTION_NAME = /^\w[\w\$\-]*$/;

// global cache to avoid re-reading the same file several times
const cache: { [path: string]: SectionDict } = {};

/**
 * @@extract pre-processor
 * Allows to extract sections from a ts file. Sections will be highlighted with the @@ts functions
 * @param section:string the relative path to a section - e.g. "./resources/sample1.ts#sectionA"
 * @param trim:boolean [optional] tell if the start & end empty lines should be removed (default: true)
 */
export function extract() {
    return {
        async process(target: XjsParamHost, params: XjsParamDictionary, ctxt: XjsPreProcessorCtxt) {
            let trim = true;
            if (params["trim"]) {
                trim = params["trim"].value === true;
            }

            let relPath = "", sectionParam: XjsParam;
            sectionParam = params["section"] || params["$$default"];
            if (sectionParam) {
                relPath = "" + (sectionParam.value || "");
            }
            if (!relPath) {
                ctxt.error("Missing file path");
            }

            let sectionDict: SectionDict, sectionName1 = "", sectionName2 = "", fileExtension = "";

            // determine target file path
            const idx = relPath.indexOf('#');
            if (idx < 0) {
                return ctxt.error("Missing section name in file path", sectionParam.pos);
            }
            sectionName1 = relPath.slice(idx + 1);
            if (sectionName1.match(RX_SECTION_REFS)) {
                sectionName1 = RegExp.$1;
                sectionName2 = RegExp.$2;
            }

            relPath = relPath.slice(0, idx);
            if (relPath.match(RX_FILE_EXT)) {
                fileExtension = RegExp.$1;
            }

            if (relPath.charAt(0) === "/") {
                ctxt.error("File path must be relative", sectionParam.pos);
            }
            let p = join(ctxt.fileId.replace(RX_FILE_NAME, ""), relPath);
            if (!isAbsolute(p)) {
                p = join(__dirname, p);
            }
            sectionDict = cache[p];

            if (sectionDict === U) {
                cache[p] = sectionDict = { lines: [], sections: [] };

                let fileContent = "";
                try {
                    fileContent = await promises.readFile(p, 'utf8');
                } catch (ex) {
                    let msg = ex.message || "" + ex;
                    if (msg.match(/no such file/i)) {
                        msg = "File not found: " + p;
                    }
                    return ctxt.error(msg);
                }

                const lines = sectionDict.lines = fileContent.split(RX_CR), len = lines.length;

                let section: Section | undefined, ln: string;
                for (let i = 0; len > i; i++) {
                    ln = lines[i];
                    if (ln.match(RX_SECTION_DEF)) {
                        // create new section
                        const sName = RegExp.$1;
                        if (sectionDict.sections[sName] !== U) {
                            ctxt.error("Invalid file content: '" + sName + "' is defined twice");
                        }
                        if (section !== U) {
                            section.nextSectionName = sName;
                        }
                        section = sectionDict.sections[sName] = {
                            lineIdx: i + 1,
                            nbrOfLines: 0,
                            nextSectionName: ""
                        };
                    } else if (section !== U) {
                        section.nbrOfLines++;
                    }
                }

                if (fileExtension === "ts") {
                    sectionDict.tokens = await tokenize(fileContent);
                } else {
                    ctxt.error("File extension must be .ts", sectionParam.pos);
                }
            }

            let section: Section = sectionDict.sections[sectionName1];
            checkSectionName(sectionName1, sectionDict, ctxt);
            if (sectionName2 !== "") {
                checkSectionName(sectionName2, sectionDict, ctxt);
            }

            const k = target.kind;
            if (k !== "#element" && k !== "#fragment" && k !== "#component" && k !== "#paramNode") {
                return ctxt.error("Only elements, fragments, components or param nodes can be used as host", target.pos);
            }

            if ((target as XjsContentHost).content !== U && (target as XjsContentHost).content!.length > 0) {
                return ctxt.error("Host cannot contain child elements", target.pos);
            }

            let host: XjsElement;
            if (k !== "#element") {
                host = createElement("div");
                addContent(host, target as any);
            } else {
                host = target as XjsElement;
            }
            addParam(createParam("class", "extract ts_code"), host);

            const lines = sectionDict.lines, len = lines.length;
            if (sectionName2 === "") {
                if (len === 0 || section.nbrOfLines === 0) return;

                appendHighlightElts(lines, sectionDict.tokens!, host, trim, section.lineIdx, section.lineIdx + section.nbrOfLines - 1);
            } else {
                let last = false;
                while (true) {
                    if (len !== 0 && section.nbrOfLines !== 0) {
                        appendHighlightElts(lines, sectionDict.tokens!, host, trim, section.lineIdx, section.lineIdx + section.nbrOfLines - 1);
                        if (last) break;
                    }
                    if (section.nextSectionName === sectionName2) {
                        last = true;
                    }
                    section = sectionDict.sections[section.nextSectionName];
                    if (section === U) break;
                }
            }
        }
    }

    function checkSectionName(name: string, sectionDict: SectionDict, ctxt: XjsPreProcessorCtxt) {
        const section: Section = sectionDict.sections[name];
        if (section === U) {
            if (!name.match(RX_SECTION_NAME)) {
                ctxt.error("Invalid section name '" + name + "'");
            } else {
                ctxt.error("Section not found '" + name + "'");
            }
        }
    }
}
