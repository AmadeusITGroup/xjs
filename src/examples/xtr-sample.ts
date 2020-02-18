import { xtr } from "../xtr/xtr";

const world = "world", txt = "abc";

const str = xtr`
    // comment
    <*cpt a="b" // comment
        bbb=123 /*
            another comment
        */ c=false ddd eee
    >
        <div x={ref}/>
        Some text here <b> and here </b> \n \a
        <foo #label #label='abc' #lbl={expr} />
        <bar [className]="abc" class={ref1} />
        <baz @deco @deco2="x" @deco3(x=123 y="abc")/>
        <.value x="z"/>
    </*cpt>

    // special chars
    angle bracket: !< 
    new line: !n
    non-breaking space: !s
    forward slash: !/
    escaped bang: !!

    // escape / special chars
    !<abc
    !<*cpt a="b" !// comment
        bbb=123 !/*
            another comment
        */ c=false ddd eee
    />
    !</div>
    !<!> no fragments
    !<${name} foo/>
    !<!cdata att=123>

    // cdata
    <!cdata att=123>
        CDATA values
        <div> Everything here is considered as a string </div>
        // including comments
        <!cdata>
        !</!cdata> // escaped cdata end
    </!cdata>

    // support of template substitution elements:
    Hello ${world}
    <div ${txt + 123} a=${txt} @deco=${1 + 2 + 3}/>
    <! ${txt}/>
    <!cdata ${txt}${txt}> rew </!cdata>
    <${txt} a="b"/>
    <${txt}>
    <div />

    // pre-processor instructions
    <div @@extract="foo/bar#blah"/>
`;

const stdStr = `
    abc ${123}
`
