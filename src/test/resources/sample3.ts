
function template(v: string) { }

// @@extract: template-section
interface IFoo {
    x: boolean;
}
const tpl = template(`(a:string) => {
    <div class="abc"> # text {a} # </>
}`);
