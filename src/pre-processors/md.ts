import { XjsParamHost, XjsParamDictionary, XjsPreProcessorCtxt, XjsCData } from './../xjs/types';
import marked from 'marked';
import { createElement, createParam, addParam, XjsParserContext, parse } from '../xjs/parser';

const U = undefined;

const RX_S_QUOTE = /\&\#39;/g,
    RX_LT = /\&lt;/g,
    RX_GT = /\&gt;/g,
    RX_AMP = /\&amp;/g,
    RX_QUOT = /\&quot;/g,
    RX_CB_OPEN = /\{/g,
    RX_CB_CLOSE = /\}/g,
    RX_NBSP = /\&nbsp;/g,
    RX_CR = /\n/,
    RX_START_SPACES = /^(\s+)/;


export function md() {
    return {
        async process(target: XjsParamHost, params: XjsParamDictionary, ctxt: XjsPreProcessorCtxt) {
            if (target.kind !== "#cdata") {
                ctxt.error("Pre-processor can only run on <!cdata> elements");
            }

            const classParam = params["class"] || params["$$default"];
            let classValue = "md";
            if (classParam) {
                classValue = "md " + (classParam.value || "");
            }

            // replace the cdata by a div element
            const p = ctxt.parent,
                content = p!.content!,
                idx = content.indexOf(target as any),
                mdText = removeStartSpaces((target as XjsCData).text);
            if (idx === -1) {
                // fwk error - should not occur
                ctxt.error("Unexpected error: cdata not found in parent element");
            }
            target = createElement("div"); // could also be createFragment
            addParam(createParam("class", classValue), target);
            content.splice(idx, 1, target);

            // generate markdown and parse resulting html
            try {
                marked.setOptions({
                    gfm: true,
                    breaks: false,
                    sanitize: false,
                    smartLists: false,
                    smartypants: false,
                    xhtml: true
                });
                const mdHTML = marked(mdText)
                    .replace(RX_S_QUOTE, "'")
                    .replace(RX_LT, "!<")
                    .replace(RX_GT, "!>")
                    .replace(RX_AMP, "&")
                    .replace(RX_QUOT, "\"")
                    .replace(RX_CB_OPEN, "!{")
                    .replace(RX_CB_CLOSE, "!}")
                    .replace(RX_NBSP, "!s");

                // parse the generated HTML
                let fragment = await parse(mdHTML, {
                    fileId: "[@@md inline HTML]",
                    templateType: "$fragment"
                });

                // move generated fragment content to the target element
                target.content = fragment.content;
                fragment.content = U;
            } catch (ex) {
                let msg = ex.message || ex;
                if (msg.match(/^XJS\:/)) {
                    // error was triggered through context.error()
                    throw ex;
                } else {
                    ctxt.error(msg);
                }
            }
        }
    }
}

function removeStartSpaces(text: string) {
    const arr = text.split(RX_CR);
    if (arr.length > 1) {
        if (arr[1].match(RX_START_SPACES)) {
            const startSpaces = RegExp.$1, startLength = startSpaces.length;
            let s: string;
            for (let i = 0; arr.length > i; i++) {
                s = arr[i];
                if (s.slice(0, startLength) === startSpaces) {
                    arr[i] = s.slice(startLength);
                }
            }
            return arr.join("\n");
        }
    }
    return text;
}
