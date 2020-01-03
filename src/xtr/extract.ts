import { XtrParamHost, XtrParamDictionary, XtrPreProcessorCtxt, XtrElement, XtrFragment, addText } from './ast';
import { join } from 'path';
import { promises } from 'fs';

const U = undefined,
    RX_FILE_NAME = /[^\/]+$/,
    RX_SECTION_START = /\/\/\s*@@extract\:/,
    RX_SECTION_NAME = /^\s*([\w\$]+) *.*\n/;

export function extract() {
    const cache: { [path: string]: { [sectionName: string]: string } } = {};

    return {
        async process(target: XtrParamHost, params: XtrParamDictionary, ctxt: XtrPreProcessorCtxt) {
            const value = params.value;
            let sections: { [sectionName: string]: string }, sectionName = "";

            if (value === U) {
                return ctxt.error("Invalid usage: file path must be provided");
            }

            // determine target file path
            let relPath = value.value as string, idx = relPath.indexOf('#');
            if (idx < 0) {
                return ctxt.error("Invalid file path: no section name provided", value.pos);
            }
            sectionName = relPath.slice(idx + 1);
            relPath = relPath.slice(0, idx);

            sections = cache[relPath];
            if (sections === U) {
                sections = {};
                if (relPath.charAt(0) === "/") {
                    ctxt.error("Invalid path: file path must be relative", value.pos);
                }
                const p = join(ctxt.fileId.replace(RX_FILE_NAME, ""), relPath);
                let content = "";

                try {
                    const f = await promises.open(p, "r");
                    content = await f.readFile({ encoding: 'utf8' });
                    f.close();
                } catch (ex) {
                    let msg = ex.message || "" + ex;
                    if (msg.match(/no such file/i)) {
                        msg = "File doesn't exist";
                    }
                    return ctxt.error(msg);
                }

                const parts = content.split(RX_SECTION_START);
                for (let part of parts) {
                    if (part.match(RX_SECTION_NAME)) {
                        const sName = RegExp.$1;
                        if (sections[sName] !== U) {
                            ctxt.error("Invalid file content: '" + sName + "' is defined twice");
                        }
                        sections[sName] = part.replace(RX_SECTION_NAME, "");
                    }
                }
                cache[relPath] = sections;
            }

            const content = sections[sectionName];
            if (content === U) {
                ctxt.error("Invalid section: '" + sectionName + "' is not defined");
            }

            const k = target.kind;
            if (k !== "#element" && k !== "#fragment") {
                return ctxt.error("Only elements and fragments can be used as host", target.pos);
            }

            const host = target as XtrElement | XtrFragment;
            if (host.children !== U && host.children.length > 0) {
                return ctxt.error("Host cannot contain child elements", target.pos);
            }
            addText(host, content);
        }
    }
}
