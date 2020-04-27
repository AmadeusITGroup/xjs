
function $fragment(strings: TemplateStringsArray, ...keys: any[]): object {
    return {};
}

const data = "data";

const str = $fragment`
    // comment
    <*a.cpt a="b" // comment
        bbb=123 /*
            another comment
        */ c=false ddd eee
    >
        <div x={ref}/>
        Some text here <b> and here </b> \n \a
        <foo #label ##label='abc' #lbl={a.b.expr} />
        <bar [className]="abc" class={ref1} />
        <baz @deco @deco2="x" @deco3(x=123 y="abc")/>
        <.value x="z"/>
    </*a.cpt>

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
    !<!cdata att=123>

    // cdata
    <!cdata att=123>
        CDATA values
        <div> Everything here is considered as a string </div>
        // including comments
        <!cdata>
        !</!cdata> // escaped cdata end
    </!cdata>

    // pre-processor instructions
    <div @@extract="foo/bar#blah"/>

    <*a.b.cpt title={a} dim=123/>

    aggregated ${data}

    // js statements
    $if (a.b.c) {
        Hi there!
    }
    $log("abc", foo.bar);
    $each(ctxt.items, (item) => {
        Hello <b> World </b>
    });
    // invalid cases
    $for (..)
    $exec ...
    $let ...
    $template ...
`;

const stdStr = `
    abc ${123}
`
