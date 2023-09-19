/* ftd-language.js */

Prism.languages.ftd = {
    'comment': [
        {
            'pattern': /\/--\s*((?!--)[\S\s])*/g,
            'greedy': true,
            'alias': "section-comment",
        },
        {
            "pattern": /[\s]*\/[\w]+(:).*\n/g,
            "greedy": true,
            "alias": "header-comment",
        },
        {
            'pattern': /(;;).*\n/g,
            'greedy': true,
            'alias': "inline-or-line-comment",
        }
    ],
    /*
    -- [section-type] <section-name>: [caption]
    [header-type] <header>: [value]

    [block headers]

    [body] -> string

    [children]

    [-- end: <section-name>]
    */
    'string': {
        'pattern': /^[ \t\n]*--\s+(.*)(\n(?![ \n\t]*--).*)*/g,
        'inside': {
            /* section-identifier */
            'section-identifier': /([ \t\n])*--\s+/g,
            /* [section type] <section name>: */
            'punctuation': {
                'pattern': /^(.*):/g,
                'inside': {
                    "semi-colon": /:/g,
                    'keyword': /^(component|record|end|or-type)/g,
                    "value-type": /^(integer|boolean|decimal|string)/g,
                    "kernel-type": /\s*ftd[\S]+/g,
                    'type-modifier': {
                        'pattern': /(\s)+list(?=\s)/g,
                        'lookbehind': true,
                    },
                    "section-name": {
                        'pattern': /(\s)*.+/g,
                        'lookbehind': true,
                    },
                }
            },
            /* section caption */
            'section-caption': /^.+(?=\n)*/g,
            /* header name: header value */
            'regex': {
                'pattern': /(?!--\s*).*[:]\s*(.*)(\n)*/g,
                'inside': {
                    /* if condition on component */
                    'header-condition': /\s*if\s*:(.)+/g,
                    /* header event */
                    'event': /\s*\$on(.)+\$(?=:)/g,
                    /* header processor */
                    'processor': /\s*\$[^:]+\$(?=:)/g,
                    /* header name => [header-type] <name> [header-condition] */
                    'regex': {
                        'pattern': /[^:]+(?=:)/g,
                        'inside': {
                            /* [header-condition]  */
                            'header-condition': /if\s*{.+}/g,
                            /* [header-type] <name> */
                            'tag': {
                                'pattern': /(.)+(?=if)?/g,
                                'inside': {
                                    'kernel-type': /^\s*ftd[\S]+/g,
                                    'header-type': /^(record|caption|body|caption or body|body or caption|integer|boolean|decimal|string)/g,
                                    'type-modifier': {
                                        'pattern': /(\s)+list(?=\s)/g,
                                        'lookbehind': true,
                                    },
                                    'header-name': {
                                        'pattern': /(\s)*(.)+/g,
                                        'lookbehind': true,
                                    },
                                }
                            }
                        }
                    },
                    /* semicolon */
                    "semi-colon": /:/g,
                    /* header value (if any) */
                    'header-value': {
                        'pattern': /(\s)*(.+)/g,
                        'lookbehind': true,
                    }
                }
            },
        },
    },
};
let fastn = {};

class Closure {
    #cached_value;
    #node;
    #property;
    #formula;
    #inherited;
    constructor(func, execute = true) {
        if (execute) {
            this.#cached_value = func();
        }
        this.#formula = func;
    }

    get() {
        return this.#cached_value;
    }
    getFormula() {
        return this.#formula;
    }
    addNodeProperty(node, property, inherited) {
        this.#node = node;
        this.#property = property;
        this.#inherited = inherited;
        this.updateUi();

        return this;
    }
    update() {
        this.#cached_value = this.#formula();
        this.updateUi();
    }
    getNode() {
        return this.#node;
    }
    updateUi() {
        if (!this.#node ||
            this.#property === null ||
            this.#property === undefined ||
            !this.#node.getNode()) {
            return;
        }

        this.#node.setStaticProperty(this.#property, this.#cached_value, this.#inherited);
    }
}

class Mutable {
    #value;
    #old_closure
    #closures;
    #closureInstance;
    constructor(val) {
        this.#value = null;
        this.#old_closure = null;
        this.#closures = [];
        this.#closureInstance = fastn.closure(() => this.#closures.forEach((closure) => closure.update()));
        this.set(val);
    }
    get(key) {
        if (!fastn_utils.isNull(key) && (this.#value instanceof RecordInstance || this.#value instanceof MutableList || this.#value instanceof Mutable)) {
            return this.#value.get(key)
        }
        return this.#value;
    }
    setWithoutUpdate(value) {
        if (this.#old_closure) {
            this.#value.removeClosure(this.#old_closure);
        }

        if (this.#value instanceof RecordInstance) {
            // this.#value.replace(value); will replace the record type
            // variable instance created which we don't want.
            // color: red
            // color if { something }: $orange-green
            // The `this.#value.replace(value);` will replace the value of
            // `orange-green` with `{light: red, dark: red}`
            this.#value = value;
        } else {
            this.#value = value;
        }

        if (this.#value instanceof Mutable) {
            this.#old_closure = fastn.closureWithoutExecute(() => this.#closureInstance.update());
            this.#value.addClosure(this.#old_closure);
        } else {
            this.#old_closure = null;
        }
    }
    set(value) {
        this.setWithoutUpdate(value);

        this.#closureInstance.update();
    }
    // we have to unlink all nodes, else they will be kept in memory after the node is removed from DOM
    unlinkNode(node) {
        this.#closures = this.#closures.filter(closure => closure.getNode() !== node);
    }
    addClosure(closure) {
        this.#closures.push(closure);
    }
    removeClosure(closure) {
        this.#closures = this.#closures.filter(c => c !== closure);
    }
    equalMutable(other) {
        if (!fastn_utils.deepEqual(this.get(), other.get())) {
            return false;
        }
        const thisClosures = this.#closures;
        const otherClosures = other.#closures;

        return thisClosures === otherClosures;
    }
    getClone() {
        return new Mutable(fastn_utils.clone(this.#value));
    }
}

class Proxy {
    #differentiator
    #cached_value
    #closures;
    #closureInstance;
    constructor(targets, differentiator) {
        this.#differentiator = differentiator;
        this.#cached_value = this.#differentiator().get();
        this.#closures = [];

        let proxy = this;
        for (let idx in targets) {
            targets[idx].addClosure(new Closure(function () {
                proxy.update();
                proxy.#closures.forEach(closure => closure.update());
            }));
            targets[idx].addClosure(this);
        }
    }
    addClosure(closure) {
        this.#closures.push(closure);
    }
    removeClosure(closure) {
        this.#closures = this.#closures.filter(c => c !== closure);
    }
    update() {
        this.#cached_value = this.#differentiator().get();
    }
    get(key) {
        if (!!key && (this.#cached_value instanceof RecordInstance || this.#cached_value instanceof MutableList || this.#cached_value instanceof Mutable)) {
            return this.#cached_value.get(key)
        }
        return this.#cached_value;
    }
    set(value) {
        // Todo: Optimization removed. Reuse optimization later again
        /*if (fastn_utils.deepEqual(this.#cached_value, value)) {
            return;
        }*/
        this.#differentiator().set(value);
    }
}

class MutableList {
    #list;
    #watchers;
    #closures;
    constructor(list) {
        this.#list = [];
        for (let idx in list) {
            this.#list.push( { item: fastn.wrapMutable(list[idx]), index: new Mutable(parseInt(idx)) });
        }
        this.#watchers = [];
        this.#closures = [];
    }
    addClosure(closure) {
        this.#closures.push(closure);
    }
    unlinkNode(node) {
        this.#closures = this.#closures.filter(closure => closure.getNode() !== node);
    }
    forLoop(root, dom_constructor) {
        let l = fastn_dom.forLoop(root, dom_constructor, this);
        this.#watchers.push(l);
        return l;
    }
    getList() {
        return this.#list;
    }
    getLength() {
        return this.#list.length;
    }
    get(idx) {
        if (fastn_utils.isNull(idx)) {
            return this.getList();
        }
        return this.#list[idx];
    }
    set(index, value) {
        if (value === undefined) {
            value = index
            if (!(value instanceof MutableList)) {
                if (!Array.isArray(value)) {
                    value = [value];
                }
                value = new MutableList(value);
            }

            let list = value.#list;
            this.#list = [];
            for (let i in list) {
                this.#list.push(list[i]);
            }

            for (let i in this.#watchers) {
                this.#watchers[i].createAllNode();
            }
        } else {
            index = fastn_utils.getFlattenStaticValue(index);
            this.#list[index].item.set(value);
        }

        this.#closures.forEach((closure) => closure.update());
    }
    insertAt(index, value) {
        index = fastn_utils.getFlattenStaticValue(index);
        let mutable = fastn.wrapMutable(value);
        this.#list.splice(index, 0, { item: mutable, index: new Mutable(index) });
        // for every item after the inserted item, update the index
        for (let i = index + 1; i < this.#list.length; i++) {
            this.#list[i].index.set(i);
        }

        for (let i in this.#watchers) {
            this.#watchers[i].createNode(index);
        }
        this.#closures.forEach((closure) => closure.update());
    }
    push(value) {
        this.insertAt(this.#list.length, value);
    }
    deleteAt(index) {
        index = fastn_utils.getFlattenStaticValue(index);
        this.#list.splice(index, 1);
        // for every item after the deleted item, update the index
        for (let i = index; i < this.#list.length; i++) {
            this.#list[i].index.set(i);
        }

        for (let i in this.#watchers) {
            let forLoop = this.#watchers[i];
            forLoop.deleteNode(index);
        }
        this.#closures.forEach((closure) => closure.update());
    }
    clearAll() {
        this.#list = [];
        for (let i in this.#watchers) {
            this.#watchers[i].deleteAllNode();
        }
        this.#closures.forEach((closure) => closure.update());
    }
    pop() {
        this.deleteAt(this.#list.length - 1);
    }
    getClone() {
        let current_list = this.#list;
        let new_list = [];
        for (let idx in current_list) {
            new_list.push(fastn_utils.clone(current_list[idx].item));
        }
        return new MutableList(new_list);
    }
}

fastn.mutable = function (val) {
    return new Mutable(val)
};

fastn.closure = function (func) {
    return new Closure(func);
}

fastn.closureWithoutExecute = function (func) {
    return new Closure(func, false);
}

fastn.formula = function (deps, func) {
    let closure = fastn.closure(func);
    let mutable = new Mutable(closure.get());
    for (let idx in deps) {
        if (fastn_utils.isNull(deps[idx]) || !deps[idx].addClosure) {
            continue;
        }
        deps[idx].addClosure(new Closure(function () {
            closure.update();
            mutable.set(closure.get());
        }));
    }

    return mutable;
}

fastn.proxy = function (targets, differentiator) {
    return new Proxy(targets, differentiator);
};


fastn.wrapMutable = function (obj) {
    if (!(obj instanceof Mutable)
        && !(obj instanceof RecordInstance)
        && !(obj instanceof MutableList)
    ) {
        obj = new Mutable(obj);
    }
    return obj;
}

fastn.mutableList = function (list) {
    return new MutableList(list);
}

class RecordInstance {
    #fields;
    #closures;
    constructor(obj) {
        this.#fields = {};
        this.#closures = [];

        for (let key in obj) {
            if (obj[key] instanceof fastn.mutableClass) {
                this.#fields[key] = fastn.mutable(null)
                this.#fields[key].setWithoutUpdate(obj[key]);
            } else {
                this.#fields[key] = fastn.mutable(obj[key]);
            }
        }
    }
    getAllFields() {
        return this.#fields;
    }
    addClosure(closure) {
        this.#closures.push(closure);
    }
    unlinkNode(node) {
        this.#closures = this.#closures.filter(closure => closure.getNode() !== node);
    }
    get(key) {
        return this.#fields[key];
    }
    set(key, value) {
        if (value === undefined) {
            value = key;
            if (!(value instanceof RecordInstance)) {
                value = new RecordInstance(value);
            }

            let fields = {};
            for(let key in value.#fields) {
                fields[key] = value.#fields[key]
            }

            this.#fields = fields;
        }
        if (this.#fields[key] === undefined) {
            this.#fields[key] = fastn.mutable(null);
            this.#fields[key].setWithoutUpdate(value);
        } else {
            this.#fields[key].set(value);
        }
        this.#closures.forEach((closure) => closure.update());
    }
    setAndReturn(key, value) {
        this.set(key, value);
        return this;
    }
    replace(obj) {
        for (let key in this.#fields) {
            if (!(key in obj.#fields)) {
                throw new Error("RecordInstance.replace: key " + key + " not present in new object");
            }
            this.#fields[key] = fastn.wrapMutable(obj.#fields[key]);
        }
        this.#closures.forEach((closure) => closure.update());
    }
    toObject() {
        return Object.fromEntries(Object.entries(this.#fields).map(([key, value]) => [
            key, 
            fastn_utils.getFlattenStaticValue(value)
        ]));
    }
    getClone() {
        let current_fields = this.#fields;
        let cloned_fields = {};
        for (let key in current_fields) {
            let value = fastn_utils.clone(current_fields[key]);
            if (value instanceof fastn.mutableClass) {
                value = value.get();
            }
            cloned_fields[key] = value;
        }
        return new RecordInstance(cloned_fields);
    }
}

class Module {
    #name;
    #global;
    constructor(name, global) {
        this.#name = name;
        this.#global = global;
    }

    get(function_name) {
        return this.#global[`${this.#name}__${function_name}`];
    }
}

fastn.recordInstance = function (obj) {
    return new RecordInstance(obj);
}

fastn.color = function (r, g, b) {
    return `rgb(${r},${g},${b})`;
}

fastn.mutableClass = Mutable;
fastn.mutableListClass = MutableList;
fastn.recordInstanceClass = RecordInstance;
fastn.module = function (name, global) {
    return new Module(name, global);
}
let fastn_dom = {};

fastn_dom.codeData = {
    availableThemes: {},
    addedCssFile: []
}

fastn_dom.externalCss = new Set();
fastn_dom.externalJs = new Set();

// Todo: Object (key, value) pair (counter type key)
fastn_dom.webComponent = [];

fastn_dom.commentNode = "comment";
fastn_dom.wrapperNode = "wrapper";
fastn_dom.commentMessage = "***FASTN***";
fastn_dom.webComponentArgument = "args";

fastn_dom.classes = { }
fastn_dom.unsanitised_classes = {}
fastn_dom.class_count = 0;
fastn_dom.propertyMap = {
    "align-items": "ali",
    "align-self": "as",
    "background-color": "bgc",
    "background-image": "bgi",
    "background-position": "bgp",
    "background-repeat": "bgr",
    "background-size": "bgs",
    "border-bottom-color": "bbc",
    "border-bottom-left-radius": "bblr",
    "border-bottom-right-radius": "bbrr",
    "border-bottom-style": "bbs",
    "border-bottom-width": "bbw",
    "border-color": "bc",
    "border-left-color": "blc",
    "border-left-style": "bls",
    "border-left-width": "blw",
    "border-radius": "br",
    "border-right-color": "brc",
    "border-right-style": "brs",
    "border-right-width": "brw",
    "border-style": "bs",
    "border-top-color": "btc",
    "border-top-left-radius": "btlr",
    "border-top-right-radius": "btrr",
    "border-top-style": "bts",
    "border-top-width": "btw",
    "border-width": "bw",
    "bottom": "b",
    "color": "c",
    "shadow": "sh",
    "cursor": "cur",
    "display": "d",
    "flex-wrap": "fw",
    "font-style": "fst",
    "font-weight": "fwt",
    "gap": "g",
    "height": "h",
    "justify-content": "jc",
    "left": "l",
    "link": "lk",
    "link-color": "lkc",
    "margin": "m",
    "margin-bottom": "mb",
    "margin-horizontal": "mh",
    "margin-left": "ml",
    "margin-right": "mr",
    "margin-top": "mt",
    "margin-vertical": "mv",
    "max-height": "mxh",
    "max-width": "mxw",
    "min-height": "mnh",
    "min-width": "mnw",
    "opacity": "op",
    "overflow": "o",
    "overflow-x": "ox",
    "overflow-y": "oy",
    "object-fit": "of",
    "padding": "p",
    "padding-bottom": "pb",
    "padding-horizontal": "ph",
    "padding-left": "pl",
    "padding-right": "pr",
    "padding-top": "pt",
    "padding-vertical": "pv",
    "position": "pos",
    "resize": "res",
    "role": "rl",
    "right": "r",
    "sticky": "s",
    "text-align": "ta",
    "text-decoration": "td",
    "text-transform": "tt",
    "top": "t",
    "width": "w",
    "z-index": "z",
    "-webkit-box-orient": "wbo",
    "-webkit-line-clamp": "wlc",
};

// dynamic-class-css.md
fastn_dom.getClassesAsString = function() {
    let classes = Object.entries(fastn_dom.classes).map(entry => {
        return getClassAsString(entry[0], entry[1]);
    });

    /*.ft_text {
        padding: 0;
    }*/
    return `<style id="styles">
    ${classes.join("\n\t")}
    </style>`;
}

function getClassAsString(className, obj) {
    if (typeof obj.value === 'object' && obj.value !== null) {
        let value = "";
        for (let key in obj.value) {
            if (obj.value[key] === undefined || obj.value[key] === null) {
                continue
            }
            value = `${value} ${key}: ${obj.value[key]}${key === "color" ? " !important": ""};`
        }
        return `${className} { ${value} }`
    } else {
        return `${className} { ${obj.property}: ${obj.value}${obj.property === "color" ? " !important": ""}; }`;
    }
}

fastn_dom.ElementKind = {
    Row: 0,
    Column: 1,
    Integer: 2,
    Decimal: 3,
    Boolean: 4,
    Text: 5,
    Image: 6,
    IFrame: 7,
    // To create parent for dynamic DOM
    Comment: 8,
    CheckBox: 9,
    TextInput: 10,
    ContainerElement: 11,
    Rive: 12,
    Document: 13,
    Wrapper: 14,
    Code: 15,
    // Note: This is called internally, it gives `code` as tagName. This is used
    // along with the Code: 15.
    CodeChild: 16,
    // Note: 'arguments' cant be used as function parameter name bcoz it has
    // internal usage in js functions.
    WebComponent: (webcomponent, args) => { return [17, [webcomponent, args]]; },
    Video: 18,
};

fastn_dom.PropertyKind = {
    Color: 0,
    IntegerValue: 1,
    StringValue: 2,
    DecimalValue: 3,
    BooleanValue: 4,
    Width: 5,
    Padding: 6,
    Height: 7,
    Id: 8,
    BorderWidth: 9,
    BorderStyle: 10,
    Margin: 11,
    Background: 12,
    PaddingHorizontal: 13,
    PaddingVertical: 14,
    PaddingLeft: 15,
    PaddingRight: 16,
    PaddingTop: 17,
    PaddingBottom: 18,
    MarginHorizontal: 19,
    MarginVertical: 20,
    MarginLeft: 21,
    MarginRight: 22,
    MarginTop: 23,
    MarginBottom: 24,
    Role: 25,
    ZIndex: 26,
    Sticky: 27,
    Top: 28,
    Bottom: 29,
    Left: 30,
    Right: 31,
    Overflow: 32,
    OverflowX: 33,
    OverflowY: 34,
    Spacing: 35,
    Wrap: 36,
    TextTransform: 37,
    TextIndent: 38,
    TextAlign: 39,
    LineClamp: 40,
    Opacity: 41,
    Cursor: 42,
    Resize: 43,
    MinHeight: 44,
    MaxHeight: 45,
    MinWidth: 46,
    MaxWidth: 47,
    WhiteSpace: 48,
    BorderTopWidth: 49,
    BorderBottomWidth: 50,
    BorderLeftWidth: 51,
    BorderRightWidth: 52,
    BorderRadius: 53,
    BorderTopLeftRadius: 54,
    BorderTopRightRadius: 55,
    BorderBottomLeftRadius: 56,
    BorderBottomRightRadius: 57,
    BorderStyleVertical: 58,
    BorderStyleHorizontal: 59,
    BorderLeftStyle: 60,
    BorderRightStyle: 61,
    BorderTopStyle: 62,
    BorderBottomStyle: 63,
    BorderColor: 64,
    BorderLeftColor: 65,
    BorderRightColor: 66,
    BorderTopColor: 67,
    BorderBottomColor: 68,
    AlignSelf: 69,
    Classes: 70,
    Anchor: 71,
    Link: 72,
    Children: 73,
    OpenInNewTab: 74,
    TextStyle: 75,
    Region: 76,
    AlignContent: 77,
    Display: 78,
    Checked: 79,
    Enabled: 80,
    TextInputType: 81,
    Placeholder: 82,
    Multiline: 83,
    DefaultTextInputValue: 84,
    Loading: 85,
    Src: 86,
    YoutubeSrc: 87,
    Code: 88,
    ImageSrc: 89,
    Alt: 90,
    DocumentProperties: {
        MetaTitle: 91,
        MetaOGTitle: 92,
        MetaTwitterTitle: 93,
        MetaDescription: 94,
        MetaOGDescription: 95,
        MetaTwitterDescription: 96,
        MetaOGImage: 97,
        MetaTwitterImage: 98,
        MetaThemeColor: 99,
    },
    Shadow: 100,
    CodeTheme: 101,
    CodeLanguage: 102,
    CodeShowLineNumber: 103,
    Css: 104,
    Js: 105,
    LinkRel: 106,
    InputMaxLength: 107,
    Favicon: 108,
    Fit: 109,
    VideoSrc: 110,
    Autoplay: 111,
    Poster: 112,
    LoopVideo: 113,
    Controls: 114,
    Muted: 115,
    LinkColor: 116,
};



fastn_dom.Loading = {
    Lazy: "lazy",
    Eager: "eager",
}

fastn_dom.LinkRel = {
    NoFollow: "nofollow",
    Sponsored: "sponsored",
    Ugc: "ugc",
}

fastn_dom.TextInputType = {
    Text: "text",
    Email: "email",
    Password: "password",
    Url: "url",
    DateTime: "datetime",
    Date: "date",
    Time: "time",
    Month: "month",
    Week: "week",
    Color: "color",
    File: "file",
}

fastn_dom.AlignContent = {
    TopLeft: "top-left",
    TopCenter: "top-center",
    TopRight: "top-right",
    Right: "right",
    Left: "left",
    Center: "center",
    BottomLeft: "bottom-left",
    BottomRight: "bottom-right",
    BottomCenter: "bottom-center",
}

fastn_dom.Region = {
    H1: "h1",
    H2: "h2",
    H3: "h3",
    H4: "h4",
    H5: "h5",
    H6: "h6",
}

fastn_dom.Anchor = {
    Window: [1, "fixed"],
    Parent: [2, "absolute"],
    Id: (value) => { return [3, value]; },
}

fastn_dom.DeviceData = {
    Desktop: "desktop",
    Mobile: "mobile",
}

fastn_dom.TextStyle = {
    Underline: "underline",
    Italic: "italic",
    Strike: "line-through",
    Heavy: "900",
    Extrabold: "800",
    Bold: "700",
    SemiBold: "600",
    Medium: "500",
    Regular: "400",
    Light: "300",
    ExtraLight: "200",
    Hairline: "100",
}

fastn_dom.Resizing = {
    FillContainer: "100%",
    HugContent: "fit-content",
    Auto: "auto",
    Fixed: (value) => { return value; }
}

fastn_dom.Spacing = {
    SpaceEvenly: [1, "space-evenly"],
    SpaceBetween: [2, "space-between"],
    SpaceAround: [3, "space-around"],
    Fixed: (value) => { return [4, value]; }
}


fastn_dom.BorderStyle = {
    Solid: "solid",
    Dashed: "dashed",
    Dotted: "dotted",
    Double: "double",
    Ridge: "ridge",
    Groove: "groove",
    Inset: "inset",
    Outset: "outset",
}

fastn_dom.Fit = {
    none: "none",
    fill: "fill",
    contain: "contain",
    cover: "cover",
    scaleDown: "scale-down",
}

fastn_dom.Overflow = {
    Scroll: "scroll",
    Visible: "visible",
    Hidden: "hidden",
    Auto: "auto",
}

fastn_dom.Display = {
    Block: "block",
    Inline: "inline",
    InlineBlock: "inline-block",
}

fastn_dom.AlignSelf = {
    Start: "start",
    Center: "center",
    End: "end",
}

fastn_dom.TextTransform = {
    None: "none",
    Capitalize: "capitalize",
    Uppercase: "uppercase",
    Lowercase: "lowercase",
    Inherit: "inherit",
    Initial: "initial",
}

fastn_dom.TextAlign = {
    Start: "start",
    Center: "center",
    End: "end",
    Justify: "justify",
}

fastn_dom.Cursor = {
    None: "none",
    Default: "default",
    ContextMenu: "context-menu",
    Help: "help",
    Pointer: "pointer",
    Progress: "progress",
    Wait: "wait",
    Cell: "cell",
    CrossHair: "crosshair",
    Text: "text",
    VerticalText: "vertical-text",
    Alias: "alias",
    Copy: "copy",
    Move: "move",
    NoDrop: "no-drop",
    NotAllowed: "not-allowed",
    Grab: "grab",
    Grabbing: "grabbing",
    EResize: "e-resize",
    NResize: "n-resize",
    NeResize: "ne-resize",
    SResize: "s-resize",
    SeResize: "se-resize",
    SwResize: "sw-resize",
    Wresize: "w-resize",
    Ewresize: "ew-resize",
    NsResize: "ns-resize",
    NeswResize: "nesw-resize",
    NwseResize: "nwse-resize",
    ColResize: "col-resize",
    RowResize: "row-resize",
    AllScroll: "all-scroll",
    ZoomIn: "zoom-in",
    ZoomOut: "zoom-out"
}

fastn_dom.Resize = {
    Vertical: "vertical",
    Horizontal: "horizontal",
    Both: "both",
}

fastn_dom.WhiteSpace = {
    Normal: "normal",
    NoWrap: "nowrap",
    Pre: "pre",
    PreLine: "pre-line",
    PreWrap: "pre-wrap",
    BreakSpaces: "break-spaces",
}



fastn_dom.BackgroundStyle = {
    Solid: (value) => {
        return [1, value];
    },
    Image: (value) => {
        return [2, value];
    },
    LinearGradient: (value) => {
        return [3, value];
    },
}

fastn_dom.BackgroundRepeat = {
    Repeat: "repeat",
    RepeatX: "repeat-x",
    RepeatY: "repeat-y",
    NoRepeat: "no-repeat",
    Space: "space",
    Round: "round",
}

fastn_dom.BackgroundSize = {
    Auto: "auto",
    Cover: "cover",
    Contain: "contain",
    Length: (value) => { return value; },
}

fastn_dom.BackgroundPosition = {
    Left: "left",
    Right: "right",
    Center: "center",
    LeftTop: "left top",
    LeftCenter: "left center",
    LeftBottom: "left bottom",
    CenterTop: "center top",
    CenterCenter: "center center",
    CenterBottom: "center bottom",
    RightTop: "right top",
    RightCenter: "right center",
    RightBottom: "right bottom",
    Length: (value) => { return value; },
}

fastn_dom.LinearGradientDirection = {
    Angle: (value) => { return `${value}deg`; },
    Turn: (value) => { return `${value}turn`; },
    Left: "270deg",
    Right: "90deg",
    Top: "0deg",
    Bottom: "180deg",
    TopLeft: "315deg",
    TopRight: "45deg",
    BottomLeft: "225deg",
    BottomRight: "135deg",
}

fastn_dom.FontSize = {
    Px: (value) => {
        if (value instanceof fastn.mutableClass) {
            return fastn.formula([value], function () { return `${value.get()}px`})
        }
        return `${value}px`;
    },
    Em: (value) => {
        if (value instanceof fastn.mutableClass) {
            return fastn.formula([value], function () { return `${value.get()}em`})
        }
        return `${value}em`;
    },
    Rem: (value) => {
        if (value instanceof fastn.mutableClass) {
            return fastn.formula([value], function () { return `${value.get()}rem`})
        }
        return `${value}rem`;
    },
}

fastn_dom.Length = {
    Px: (value) => {
        if (value instanceof fastn.mutableClass) {
            return fastn.formula([value], function () { return `${value.get()}px`})
        }
        return `${value}px`;
    },
    Em: (value) => {
        if (value instanceof fastn.mutableClass) {
            return fastn.formula([value], function () { return `${value.get()}em`})
        }
        return `${value}em`;
    },
    Rem: (value) => {
        if (value instanceof fastn.mutableClass) {
            return fastn.formula([value], function () { return `${value.get()}rem`})
        }
        return `${value}rem`;
    },
    Percent: (value) => {
        if (value instanceof fastn.mutableClass) {
            return fastn.formula([value], function () { return `${value.get()}%`})
        }
        return `${value}%`;
    },
    Calc: (value) => {
        if (value instanceof fastn.mutableClass) {
            return fastn.formula([value], function () { return `calc(${value.get()})`})
        }
        return `calc(${value})`;
    },
    Vh: (value) => {
        if (value instanceof fastn.mutableClass) {
            return fastn.formula([value], function () { return `${value.get()}vh`})
        }
        return `${value}vh`;
    },
    Vw: (value) => {
        if (value instanceof fastn.mutableClass) {
            return fastn.formula([value], function () { return `${value.get()}vw`})
        }
        return `${value}vw`;
    },
    Vmin: (value) => {
        if (value instanceof fastn.mutableClass) {
            return fastn.formula([value], function () { return `${value.get()}vmin`})
        }
        return `${value}vmin`;
    },
    Vmax: (value) => {
        if (value instanceof fastn.mutableClass) {
            return fastn.formula([value], function () { return `${value.get()}vmax`})
        }
        return `${value}vmax`;
    },
    Responsive: (length) => {
        return new PropertyValueAsClosure(
            () => {
                if (ftd.device.get() === "desktop") {
                    return length.get("desktop");
                } else {
                    let mobile = length.get("mobile");
                    let desktop = length.get("desktop");
                    return mobile ? mobile: desktop;
                }
            },
            [ftd.device, length]
        );
    }
}



fastn_dom.Event = {
    Click: 0,
    MouseEnter: 1,
    MouseLeave: 2,
    ClickOutside: 3,
    GlobalKey: (val) => {return [4, val];},
    GlobalKeySeq: (val) => {return [5, val];},
    Input: 6,
    Change: 7,
    Blur: 8,
    Focus: 9,
}

class PropertyValueAsClosure {
    closureFunction;
    deps;
    constructor(closureFunction, deps) {
        this.closureFunction = closureFunction;
        this.deps = deps;
    }
}

// Node2 -> Intermediate node
// Node -> similar to HTML DOM node (Node2.#node)
class Node2 {
    #node;
    #kind;
    #parent;
    #tagName;
    #rawInnerValue;
    /**
     * This is where we store all the attached closures, so we can free them
     * when we are done.
     */
    #mutables;
    /**
     * This is where we store the extraData related to node. This is
     * especially useful to store data for integrated external library (like
     * rive).
     */
    #extraData;
    #children;
    constructor(parentOrSibiling, kind) {
        this.#kind = kind;
        this.#parent = parentOrSibiling;
        this.#children = [];
        this.#rawInnerValue = null;

        let sibiling = undefined;

        if (parentOrSibiling instanceof ParentNodeWithSibiling) {
            this.#parent = parentOrSibiling.getParent();
            while(this.#parent instanceof ParentNodeWithSibiling) {
                this.#parent = this.#parent.getParent();
            }
            sibiling = parentOrSibiling.getSibiling();
        }

        this.createNode(kind);

        this.#mutables = [];
        this.#extraData = {};
        /*if (!!parent.parent) {
            parent = parent.parent();
        }*/


        if (this.#parent.getNode) {
            this.#parent = this.#parent.getNode();
        }

        if (fastn_utils.isWrapperNode(this.#tagName)) {
            this.#parent = parentOrSibiling;
            return;
        }
        if (sibiling) {
            this.#parent.insertBefore(this.#node, fastn_utils.nextSibling(sibiling, this.#parent));
        } else {
            this.#parent.appendChild(this.#node);
        }
    }
    createNode(kind) {
        if (kind === fastn_dom.ElementKind.Code) {
            let [node, classes, attributes] = fastn_utils.htmlNode(kind);
            [this.#tagName, this.#node] = fastn_utils.createNodeHelper(node, classes, attributes);
            let codeNode = new Node2(this.#node, fastn_dom.ElementKind.CodeChild);
            this.#children.push(codeNode);
        } else {
            let [node, classes, attributes] = fastn_utils.htmlNode(kind);
            [this.#tagName, this.#node] = fastn_utils.createNodeHelper(node, classes, attributes);
        }
    }
    getTagName(){
        return this.#tagName;
    }
    getParent() {
        return this.#parent;
    }
    removeAllFaviconLinks() {
        if (hydrating) {
            const links = document.head.querySelectorAll('link[rel="shortcut icon"]');
            links.forEach( link => {
                link.parentNode.removeChild(link);
            });
        }
    }

    setFavicon(url) {
        if (hydrating) {
            if (url instanceof fastn.recordInstanceClass) url = url.get('src');
            while (true) {
                if (url instanceof fastn.mutableClass) url = url.get();
                else break;
            }

            let link_element = document.createElement("link");
            link_element.rel = "shortcut icon";
            link_element.href = url;

            this.removeAllFaviconLinks();
            document.head.appendChild(link_element);
        }
    }
    // for attaching inline attributes
    attachAttribute(property, value) {
        // If the value is null, undefined, or false, the attribute will be removed.
        // For example, if attributes like checked, muted, or autoplay have been assigned a "false" value.
        if (fastn_utils.isNull(value)) {
            this.#node.removeAttribute(property);
            return;
        }
        this.#node.setAttribute(property, value);
    }
    removeAttribute(property) {
        this.#node.removeAttribute(property);
    }
    updateTagName(name) {
        if (ssr) {
            this.#node.updateTagName(name);
        }
    }
    updateToAnchor(url) {
        let node_kind = this.#kind;
        if (ssr) {
            if (node_kind !== fastn_dom.ElementKind.Image) {
                this.updateTagName('a');
                this.attachAttribute("href", url);
            }
            return;
        }
        if (node_kind === fastn_dom.ElementKind.Image) {
            let anchorElement = document.createElement("a");
            anchorElement.href = url;
            anchorElement.appendChild(this.#node);
            this.#parent.appendChild(anchorElement);
            this.#node = anchorElement;
        } else {
            let anchorElement = document.createElement("a");
            anchorElement.href = url;
            anchorElement.innerHTML = this.#node.innerHTML;
            anchorElement.className = this.#node.className;
            anchorElement.style = this.#node.style;
            for (var i = 0; i < this.#node.attributes.length; i++) {
                var attr = this.#node.attributes[i];
                anchorElement.setAttribute(attr.name, attr.value);
            }
            var eventListeners = fastn_utils.getEventListeners(this.#node);
            for (var eventType in eventListeners) {
                anchorElement[eventType] = eventListeners[eventType];
            }
            this.#parent.replaceChild(anchorElement, this.#node);
            this.#node = anchorElement;
        }
    }
    updatePositionForNodeById(node_id, value) {
        if (!ssr) {
            const target_node = document.querySelector(`[id="${node_id}"]`);
            if (!fastn_utils.isNull(target_node))
                target_node.style['position'] = value;
        }
    }
    updateParentPosition(value) {
        if (ssr) {
            let parent = this.#parent;
            if (parent.style) parent.style["position"] = value;
        }
        if (!ssr) {
            let current_node = this.#node;
            if (current_node) {
                let parent_node = current_node.parentNode;
                parent_node.style['position'] = value;
            }
        }
    }
    updateMetaTitle(value) {
        if (!ssr && hydrating) {
            if (!fastn_utils.isNull(value)) window.document.title = value;
        }
    }
    addMetaTagByName(name, value) {
        if (value === null || value === undefined) {
            this.removeMetaTagByName(name);
            return;
        }
        if (!ssr && hydrating) {
            const metaTag = window.document.createElement('meta');
            metaTag.setAttribute('name', name);
            metaTag.setAttribute('content', value);
            document.head.appendChild(metaTag);
        }
    }
    addMetaTagByProperty(property, value) {
        if (value === null || value === undefined) {
            this.removeMetaTagByProperty(property);
            return;
        }
        if (!ssr && hydrating) {
            const metaTag = window.document.createElement('meta');
            metaTag.setAttribute('property', property);
            metaTag.setAttribute('content', value);
            document.head.appendChild(metaTag);
        }
    }
    removeMetaTagByName(name) {
        if (!ssr && hydrating) {
            const metaTags = document.getElementsByTagName('meta');
            for (let i = 0; i < metaTags.length; i++) {
                const metaTag = metaTags[i];
                if (metaTag.getAttribute('name') === name) {
                    metaTag.remove();
                    break;
                }
            }
        }
    }
    removeMetaTagByProperty(property) {
        if (!ssr && hydrating) {
            const metaTags = document.getElementsByTagName('meta');
            for (let i = 0; i < metaTags.length; i++) {
                const metaTag = metaTags[i];
                if (metaTag.getAttribute('property') === property) {
                    metaTag.remove();
                    break;
                }
            }
        }
    }
    // dynamic-class-css
    attachCss(property, value, createClass, className) {
        let propertyShort = fastn_dom.propertyMap[property] || property;
        propertyShort = `__${propertyShort}`;
        let cls = `${propertyShort}-${JSON.stringify(fastn_dom.class_count)}`;
        if (!!className) {
           cls = className;
        } else {
            if (!fastn_dom.unsanitised_classes[cls]) {
                fastn_dom.unsanitised_classes[cls] = ++fastn_dom.class_count;
            }
            cls = `${propertyShort}-${fastn_dom.unsanitised_classes[cls]}`;
        }
        let cssClass = className ? cls : `.${cls}`;

        const obj = { property, value };

        if (value === undefined) {
            if (!ssr && !hydrating) {
                for (const className of this.#node.classList.values()) {
                    if (className.startsWith(`${propertyShort}-`)) {
                        this.#node.classList.remove(className);
                    }
                }
                this.#node.style[property] = null;
            }
            return cls;
        }

        if (!ssr && !hydrating) {
            if (!!className) {
                if (!fastn_dom.classes[cssClass]) {
                    fastn_dom.classes[cssClass] = fastn_dom.classes[cssClass] || obj;
                    let styles = document.getElementById('styles');
                    styles.innerHTML = `${styles.innerHTML}${getClassAsString(cssClass, obj)}\n`;
                }
                return cls;
            }

            for (const className of this.#node.classList.values()) {
                if (className.startsWith(`${propertyShort}-`)) {
                    this.#node.classList.remove(className);
                }
            }

            if (createClass) {
                if (!fastn_dom.classes[cssClass]) {
                    fastn_dom.classes[cssClass] = fastn_dom.classes[cssClass] || obj;
                    let styles = document.getElementById('styles');
                    styles.innerHTML = `${styles.innerHTML}${getClassAsString(cssClass, obj)}\n`;
                }
                this.#node.style.removeProperty(property);
                this.#node.classList.add(cls);
            } else if (!fastn_dom.classes[cssClass]) {
                if (typeof value === 'object' && value !== null) {
                    for (let key in value) {
                        this.#node.style[key] = value[key];
                    }
                } else {
                    this.#node.style[property] = value;
                }
            } else {
                this.#node.style.removeProperty(property);
                this.#node.classList.add(cls);
            }

            return cls;
        }

        fastn_dom.classes[cssClass] = fastn_dom.classes[cssClass] || obj;

        if (!!className) {
            return cls;
        }

        this.#node.classList.add(cls);
        return cls;
    }
    attachShadow(value) {
        if (fastn_utils.isNull(value)) {
            this.attachCss("box-shadow", value);
            return;
        }

        const color = value.get("color");

        const lightColor = fastn_utils.getStaticValue(color.get("light"));
        const darkColor = fastn_utils.getStaticValue(color.get("dark"));

        const blur = fastn_utils.getStaticValue(value.get("blur"));
        const xOffset = fastn_utils.getStaticValue(value.get("x_offset"));
        const yOffset = fastn_utils.getStaticValue(value.get("y_offset"));
        const spread = fastn_utils.getStaticValue(value.get("spread"));
        const inset = fastn_utils.getStaticValue(value.get("inset"));

        const shadowCommonCss = `${inset ? "inset " : ""}${xOffset} ${yOffset} ${blur} ${spread}`;
        const lightShadowCss =  `${shadowCommonCss} ${lightColor}`;
        const darkShadowCss = `${shadowCommonCss} ${darkColor}`;

        if (lightShadowCss === darkShadowCss) {
            this.attachCss("box-shadow", lightShadowCss, false);
        } else {
            let lightClass = this.attachCss("box-shadow", lightShadowCss, true);
            this.attachCss("box-shadow", darkShadowCss, true, `body.dark .${lightClass}`);
        }
    }
    attachLinearGradientCss(value) {
        if (fastn_utils.isNull(value)) {
            this.attachCss("background-image", value);
            return;
        }
        var lightGradientString = "";
        var darkGradientString = "";

        let colorsList = value.get("colors").get().getList();
        let direction = fastn_utils.getStaticValue(value.get("direction"));
        colorsList.map(function (element) {
            // LinearGradient RecordInstance
            let lg_color = element.item;

            let color = lg_color.get("color").get();
            let lightColor = fastn_utils.getStaticValue(color.get("light"));
            let darkColor = fastn_utils.getStaticValue(color.get("dark"));

            lightGradientString = `${lightGradientString} ${lightColor}`;
            darkGradientString = `${darkGradientString} ${darkColor}`;

            let start = fastn_utils.getStaticValue(lg_color.get("start"));
            if (start !== undefined && start !== null ) {
                lightGradientString = `${lightGradientString} ${start}`;
                darkGradientString = `${darkGradientString} ${start}`;
            }

            let end = fastn_utils.getStaticValue(lg_color.get("end"));
            if (end !== undefined && end !== null ) {
                lightGradientString = `${lightGradientString} ${end}`;
                darkGradientString = `${darkGradientString} ${end}`;
            }

            let stop_position = fastn_utils.getStaticValue(lg_color.get("stop_position"));
            if (stop_position !== undefined && stop_position !== null ) {
                lightGradientString = `${lightGradientString}, ${stop_position}`;
                darkGradientString = `${darkGradientString}, ${stop_position}`;
            }

            lightGradientString = `${lightGradientString},`
            darkGradientString = `${darkGradientString},`
        });

        lightGradientString = lightGradientString.trim().slice(0, -1);
        darkGradientString = darkGradientString.trim().slice(0, -1);

        if (lightGradientString === darkGradientString) {
            this.attachCss("background-image", `linear-gradient(${direction}, ${lightGradientString})`, false);
        } else {
            let lightClass = this.attachCss("background-image", `linear-gradient(${direction}, ${lightGradientString})`,true);
            this.attachCss("background-image", `linear-gradient(${direction}, ${darkGradientString})`, true, `body.dark .${lightClass}`);
        }
    }
    attachBackgroundImageCss(value) {
        if (fastn_utils.isNull(value)) {
            this.attachCss("background-repeat", value);
            this.attachCss("background-position", value);
            this.attachCss("background-size", value);
            this.attachCss("background-image", value);
            return;
        }

        let src = fastn_utils.getStaticValue(value.get("src"));
        let lightValue = fastn_utils.getStaticValue(src.get("light"));
        let darkValue = fastn_utils.getStaticValue(src.get("dark"));

        let position = fastn_utils.getStaticValue(value.get("position"));
        let positionX = null;
        let positionY = null;
        if (position !== null && position instanceof Object) {
            positionX = fastn_utils.getStaticValue(position.get("x"));
            positionY = fastn_utils.getStaticValue(position.get("y"));

            if (positionX !== null) position = `${positionX}`;
            if (positionY !== null) {
                if (positionX === null) position = `0px ${positionY}`;
                else position = `${position} ${positionY}`;
            }
        }
        let repeat = fastn_utils.getStaticValue(value.get("repeat"));
        let size = fastn_utils.getStaticValue(value.get("size"));
        let sizeX = null;
        let sizeY = null;
        if (size !== null && size instanceof Object) {
            sizeX = fastn_utils.getStaticValue(size.get("x"));
            sizeY = fastn_utils.getStaticValue(size.get("y"));

            if (sizeX !== null) size = `${sizeX}`;
            if (sizeY !== null) {
                if (sizeX === null) size = `0px ${sizeY}`;
                else size = `${size} ${sizeY}`;
            }
        }

        if (repeat !== null) this.attachCss("background-repeat", repeat);
        if (position !== null) this.attachCss("background-position", position);
        if (size !== null)  this.attachCss("background-size", size);

        if (lightValue === darkValue) {
            this.attachCss("background-image", `url(${lightValue})`, false);
        } else {
            let lightClass = this.attachCss("background-image", `url(${lightValue})`, true);
            this.attachCss("background-image", `url(${darkValue})`, true, `body.dark .${lightClass}`);
        }
    }
    attachExternalCss(css) {
        if (hydrating) {
            let css_tag = document.createElement('link');
            css_tag.rel = 'stylesheet';
            css_tag.type = 'text/css';
            css_tag.href = css;

            let head = document.head || document.getElementsByTagName("head")[0];
            if (!fastn_dom.externalCss.has(css)){
                head.appendChild(css_tag);
                fastn_dom.externalCss.add(css);
            }
        }
    }
    attachExternalJs(js) {
        if (hydrating) {
            let js_tag = document.createElement('script');
            js_tag.src = js;

            let head = document.head || document.getElementsByTagName("head")[0];
            if (!fastn_dom.externalJs.has(js)){
                head.appendChild(js_tag);
                fastn_dom.externalCss.add(js);
            }
        }
    }
    attachColorCss(property, value, visited) {
        if (fastn_utils.isNull(value)) {
            this.attachCss(property, value);
            return;
        }
        let lightValue = fastn_utils.getStaticValue(value.get("light"));
        let darkValue = fastn_utils.getStaticValue(value.get("dark"));
        if (lightValue === darkValue) {
            this.attachCss(property, lightValue, false);
        } else {
            let lightClass = this.attachCss(property, lightValue, true);
            this.attachCss(property, darkValue, true, `body.dark .${lightClass}`);
            if (visited) {
                this.attachCss(property, lightValue, true, `.${lightClass}:visited`);
                this.attachCss(property, darkValue, true, `body.dark  .${lightClass}:visited`);
            }
        }
    }
    attachRoleCss(value) {
        if (fastn_utils.isNull(value)) {
            this.attachCss('role', value);
            return;
        }
        let desktopValue = fastn_utils.getStaticValue(value.get("desktop"));
        let mobileValue = fastn_utils.getStaticValue(value.get("mobile"));
        if (fastn_utils.sameResponsiveRole(desktopValue, mobileValue)) {
            this.attachCss("role", fastn_utils.getRoleValues(desktopValue), true);
        } else {
            let desktopClass = this.attachCss("role", fastn_utils.getRoleValues(desktopValue), true);
            this.attachCss("role", fastn_utils.getRoleValues(mobileValue), true, `body.mobile .${desktopClass}`);
        }
    }
    attachTextStyles(styles) {
        if (fastn_utils.isNull(styles)) {
            this.attachCss('font-style', styles);
            this.attachCss('font-weight', styles);
            this.attachCss('text-decoration', styles);
            return;
        }
        for (var s of styles) {
            switch (s) {
              case 'italic':
                this.attachCss("font-style", s);
                break;
              case 'underline':
              case 'line-through':
                this.attachCss("text-decoration", s);
                break;
              default:
                this.attachCss("font-weight", s);
            }
        }
    }
    attachAlignContent(value, node_kind) {
        if (fastn_utils.isNull(value)) {
            this.attachCss('align-items', value);
            this.attachCss("justify-content", value);
            return;
        }
        if (node_kind === fastn_dom.ElementKind.Column) {
            switch (value) {
                case 'top-left':
                    this.attachCss("justify-content", "start");
                    this.attachCss("align-items", "start");
                    break;
                case 'top-center':
                    this.attachCss("justify-content", "start");
                    this.attachCss("align-items", "center");
                    break;
                case 'top-right':
                    this.attachCss("justify-content", "start");
                    this.attachCss("align-items", "end");
                    break;
                case 'left':
                    this.attachCss("justify-content", "center");
                    this.attachCss("align-items", "start");
                    break;
                case 'center':
                    this.attachCss("justify-content", "center");
                    this.attachCss("align-items", "center");
                    break;
                case 'right':
                    this.attachCss("justify-content", "center");
                    this.attachCss("align-items", "end");
                    break;
                case 'bottom-left':
                    this.attachCss("justify-content", "end");
                    this.attachCss("align-items", "left");
                    break;
                case 'bottom-center':
                    this.attachCss("justify-content", "end");
                    this.attachCss("align-items", "center");
                    break;
                case 'bottom-right':
                    this.attachCss("justify-content", "end");
                    this.attachCss("align-items", "end");
                    break;
            }
        }

        if (node_kind === fastn_dom.ElementKind.Row) {
            switch (value) {
                case 'top-left':
                    this.attachCss("justify-content", "start");
                    this.attachCss("align-items", "start");
                    break;
                case 'top-center':
                    this.attachCss("justify-content", "center");
                    this.attachCss("align-items", "start");
                    break;
                case 'top-right':
                    this.attachCss("justify-content", "end");
                    this.attachCss("align-items", "start");
                    break;
                case 'left':
                    this.attachCss("justify-content", "start");
                    this.attachCss("align-items", "center");
                    break;
                case 'center':
                    this.attachCss("justify-content", "center");
                    this.attachCss("align-items", "center");
                    break;
                case 'right':
                    this.attachCss("justify-content", "right");
                    this.attachCss("align-items", "center");
                    break;
                case 'bottom-left':
                    this.attachCss("justify-content", "start");
                    this.attachCss("align-items", "end");
                    break;
                case 'bottom-center':
                    this.attachCss("justify-content", "center");
                    this.attachCss("align-items", "end");
                    break;
                case 'bottom-right':
                    this.attachCss("justify-content", "end");
                    this.attachCss("align-items", "end");
                    break;
            }
        }
    }
    attachLinkColor(value) {
        ftd.dark_mode.addClosure(fastn.closure(() => {
            if (!ssr) {
                const anchors = this.#node.tagName.toLowerCase() === 'a'
                    ? [this.#node]
                    : Array.from(this.#node.querySelectorAll("a"));
                let propertyShort = `__${fastn_dom.propertyMap["link-color"]}`;

                if(fastn_utils.isNull(value)) {
                    anchors.forEach(a => {
                        a.classList.values().forEach(className => {
                            if(className.startsWith(`${propertyShort}-`)) {
                                a.classList.remove(className);
                            }
                        });
                    });
                } else {
                    const lightValue = fastn_utils.getStaticValue(value.get("light"));
                    const darkValue = fastn_utils.getStaticValue(value.get("dark"));
                    let cls = `${propertyShort}-${JSON.stringify(lightValue)}`;
                    
                    if (!fastn_dom.unsanitised_classes[cls]) {
                        fastn_dom.unsanitised_classes[cls] = ++fastn_dom.class_count;
                    }

                    cls = `${propertyShort}-${fastn_dom.unsanitised_classes[cls]}`;

                    const cssClass = `.${cls}`;

                    if (!fastn_dom.classes[cssClass]) {
                        const obj = { property: "color", value: lightValue };
                        fastn_dom.classes[cssClass] = fastn_dom.classes[cssClass] || obj;
                        let styles = document.getElementById('styles');
                        styles.innerHTML = `${styles.innerHTML}${getClassAsString(cssClass, obj)}\n`;
                    }

                    if(lightValue !== darkValue) {
                        const obj = { property: "color", value: darkValue };
                        let darkCls = `body.dark ${cssClass}`;
                        if (!fastn_dom.classes[darkCls]) {
                            fastn_dom.classes[darkCls] = fastn_dom.classes[darkCls] || obj;
                            let styles = document.getElementById('styles');
                            styles.innerHTML = `${styles.innerHTML}${getClassAsString(darkCls, obj)}\n`;
                        }
                    }

                    anchors.forEach(a => a.classList.add(cls));
                }
            }
        }).addNodeProperty(this, null, inherited));
        this.#mutables.push(ftd.dark_mode);
    }
    setStaticProperty(kind, value, inherited) {
        // value can be either static or mutable
        let staticValue = fastn_utils.getStaticValue(value);
        if (kind === fastn_dom.PropertyKind.Children) {
            if (fastn_utils.isWrapperNode(this.#tagName)) {
                let parentWithSibiling = this.#parent;
                if (Array.isArray(staticValue)) {
                    staticValue.forEach((func, index) => {
                        if (index !== 0) {
                            parentWithSibiling = new ParentNodeWithSibiling(this.#parent.getParent(), this.#children[index-1]);
                        }
                        this.#children.push(fastn_utils.getStaticValue(func.item)(parentWithSibiling, inherited))
                    });
                } else {
                    this.#children.push(staticValue(parentWithSibiling, inherited));
                }
            } else {
                if (Array.isArray(staticValue)) {
                    staticValue.forEach(func =>
                        this.#children.push(fastn_utils.getStaticValue(func.item)(this, inherited)));
                } else {
                    this.#children.push(staticValue(this, inherited));
                }
            }
        } else if (kind === fastn_dom.PropertyKind.Id) {
            this.#node.id = staticValue;
        } else if (kind === fastn_dom.PropertyKind.Css) {
            let css_list = staticValue.map(obj => fastn_utils.getStaticValue(obj.item));
            css_list.forEach((css) => {
                this.attachExternalCss(css);
            });
        } else if (kind === fastn_dom.PropertyKind.Js) {
            let js_list = staticValue.map(obj => fastn_utils.getStaticValue(obj.item));
            js_list.forEach((js) => {
                this.attachExternalJs(js);
            });
        } else if (kind === fastn_dom.PropertyKind.Width) {
            this.attachCss("width", staticValue);
        } else if (kind === fastn_dom.PropertyKind.Height) {
            fastn_utils.resetFullHeight();
            this.attachCss("height", staticValue);
            fastn_utils.setFullHeight();
        } else if (kind === fastn_dom.PropertyKind.Padding) {
            this.attachCss("padding", staticValue);
        } else if (kind === fastn_dom.PropertyKind.PaddingHorizontal) {
            this.attachCss("padding-left", staticValue);
            this.attachCss("padding-right", staticValue);
        } else if (kind === fastn_dom.PropertyKind.PaddingVertical) {
            this.attachCss("padding-top", staticValue);
            this.attachCss("padding-bottom", staticValue);
        } else if (kind === fastn_dom.PropertyKind.PaddingLeft) {
            this.attachCss("padding-left", staticValue);
        } else if (kind === fastn_dom.PropertyKind.PaddingRight) {
            this.attachCss("padding-right", staticValue);
        } else if (kind === fastn_dom.PropertyKind.PaddingTop) {
            this.attachCss("padding-top", staticValue);
        } else if (kind === fastn_dom.PropertyKind.PaddingBottom) {
            this.attachCss("padding-bottom", staticValue);
        } else if (kind === fastn_dom.PropertyKind.Margin) {
            this.attachCss("margin", staticValue);
        } else if (kind === fastn_dom.PropertyKind.MarginHorizontal) {
            this.attachCss("margin-left", staticValue);
            this.attachCss("margin-right", staticValue);
        } else if (kind === fastn_dom.PropertyKind.MarginVertical) {
            this.attachCss("margin-top", staticValue);
            this.attachCss("margin-bottom", staticValue);
        } else if (kind === fastn_dom.PropertyKind.MarginLeft) {
            this.attachCss("margin-left", staticValue);
        } else if (kind === fastn_dom.PropertyKind.MarginRight) {
            this.attachCss("margin-right", staticValue);
        } else if (kind === fastn_dom.PropertyKind.MarginTop) {
            this.attachCss("margin-top", staticValue);
        } else if (kind === fastn_dom.PropertyKind.MarginBottom) {
            this.attachCss("margin-bottom", staticValue);
        } else if (kind === fastn_dom.PropertyKind.BorderWidth) {
            this.attachCss("border-width", staticValue);
        } else if (kind === fastn_dom.PropertyKind.BorderTopWidth) {
            this.attachCss("border-top-width", staticValue);
        } else if (kind === fastn_dom.PropertyKind.BorderBottomWidth) {
            this.attachCss("border-bottom-width", staticValue);
        } else if (kind === fastn_dom.PropertyKind.BorderLeftWidth) {
            this.attachCss("border-left-width", staticValue);
        } else if (kind === fastn_dom.PropertyKind.BorderRightWidth) {
            this.attachCss("border-right-width", staticValue);
        } else if (kind === fastn_dom.PropertyKind.BorderRadius) {
            this.attachCss("border-radius", staticValue);
        } else if (kind === fastn_dom.PropertyKind.BorderTopLeftRadius) {
            this.attachCss("border-top-left-radius", staticValue);
        } else if (kind === fastn_dom.PropertyKind.BorderTopRightRadius) {
            this.attachCss("border-top-right-radius", staticValue);
        } else if (kind === fastn_dom.PropertyKind.BorderBottomLeftRadius) {
            this.attachCss("border-bottom-left-radius", staticValue);
        } else if (kind === fastn_dom.PropertyKind.BorderBottomRightRadius) {
            this.attachCss("border-bottom-right-radius", staticValue);
        } else if (kind === fastn_dom.PropertyKind.BorderStyle) {
            this.attachCss("border-style", staticValue);
        } else if (kind === fastn_dom.PropertyKind.BorderStyleVertical) {
            this.attachCss("border-top-style", staticValue);
            this.attachCss("border-bottom-style", staticValue);
        } else if (kind === fastn_dom.PropertyKind.BorderStyleHorizontal) {
            this.attachCss("border-left-style", staticValue);
            this.attachCss("border-right-style", staticValue);
        } else if (kind === fastn_dom.PropertyKind.BorderLeftStyle) {
            this.attachCss("border-left-style", staticValue);
        } else if (kind === fastn_dom.PropertyKind.BorderRightStyle) {
            this.attachCss("border-right-style", staticValue);
        } else if (kind === fastn_dom.PropertyKind.BorderTopStyle) {
            this.attachCss("border-top-style", staticValue);
        } else if (kind === fastn_dom.PropertyKind.BorderBottomStyle) {
            this.attachCss("border-bottom-style", staticValue);
        } else if (kind === fastn_dom.PropertyKind.ZIndex) {
            this.attachCss("z-index", staticValue);
        } else if (kind === fastn_dom.PropertyKind.Shadow) {
            this.attachShadow(staticValue);
        } else if (kind === fastn_dom.PropertyKind.Classes) {
            fastn_utils.removeNonFastnClasses(this);
            if (!fastn_utils.isNull(staticValue)) {
                let cls = staticValue.map(obj => fastn_utils.getStaticValue(obj.item));
                cls.forEach((c) => {
                    this.#node.classList.add(c);
                });
            }
        } else if (kind === fastn_dom.PropertyKind.Anchor) {
            // todo: this needs fixed for anchor.id = v
            // need to change position of element with id = v to relative
            if (fastn_utils.isNull(staticValue)) {
                this.attachCss("position", staticValue);
                return;
            }

            let anchorType = staticValue[0];
            switch (anchorType) {
              case 1:
                this.attachCss("position", staticValue[1]);
                break;
              case 2:
                this.attachCss("position", staticValue[1]);
                this.updateParentPosition("relative");
                break;
              case 3:
                const parent_node_id = staticValue[1];
                this.attachCss("position", "absolute");
                this.updatePositionForNodeById(parent_node_id, "relative");
                break;
            }
        } else if (kind === fastn_dom.PropertyKind.Sticky) {
            // sticky is boolean type
            switch (staticValue) {
              case 'true':
              case true:
                this.attachCss("position", "sticky");
                break;
              case 'false':
              case false:
                this.attachCss("position", "static");
                break;
              default:
                this.attachCss("position", staticValue);
            }
        } else if (kind === fastn_dom.PropertyKind.Top) {
            this.attachCss("top", staticValue);
        } else if (kind === fastn_dom.PropertyKind.Bottom) {
            this.attachCss("bottom", staticValue);
        } else if (kind === fastn_dom.PropertyKind.Left) {
            this.attachCss("left", staticValue);
        } else if (kind === fastn_dom.PropertyKind.Right) {
            this.attachCss("right", staticValue);
        } else if (kind === fastn_dom.PropertyKind.Overflow) {
            this.attachCss("overflow", staticValue);
        } else if (kind === fastn_dom.PropertyKind.OverflowX) {
            this.attachCss("overflow-x", staticValue);
        } else if (kind === fastn_dom.PropertyKind.OverflowY) {
            this.attachCss("overflow-y", staticValue);
        } else if (kind === fastn_dom.PropertyKind.Spacing) {
            if (fastn_utils.isNull(staticValue)) {
                this.attachCss("justify-content", staticValue);
                this.attachCss("gap", staticValue);
                return;
            }

            let spacingType = staticValue[0];
            switch (spacingType) {
                case fastn_dom.Spacing.SpaceEvenly[0]:
                case fastn_dom.Spacing.SpaceBetween[0]:
                case fastn_dom.Spacing.SpaceAround[0]:
                    this.attachCss("justify-content", staticValue[1]);
                    break;
                case fastn_dom.Spacing.Fixed()[0]:
                    this.attachCss("gap", staticValue[1]);
                    break;
            }

        } else if (kind === fastn_dom.PropertyKind.Wrap) {
            // sticky is boolean type
            switch (staticValue) {
              case 'true':
              case true:
                this.attachCss("flex-wrap", "wrap");
                break;
              case 'false':
              case false:
                this.attachCss("flex-wrap", "no-wrap");
                break;
              default:
                this.attachCss("flex-wrap", staticValue);
            }
        } else if (kind === fastn_dom.PropertyKind.TextTransform) {
            this.attachCss("text-transform", staticValue);
        } else if (kind === fastn_dom.PropertyKind.TextIndent) {
            this.attachCss("text-indent", staticValue);
        } else if (kind === fastn_dom.PropertyKind.TextAlign) {
            this.attachCss("text-align", staticValue);
        } else if (kind === fastn_dom.PropertyKind.LineClamp) {
            // -webkit-line-clamp: staticValue
            // display: -webkit-box, overflow: hidden
            // -webkit-box-orient: vertical
            this.attachCss("-webkit-line-clamp", staticValue);
            this.attachCss("display", "-webkit-box");
            this.attachCss("overflow", "hidden");
            this.attachCss("-webkit-box-orient", "vertical");
        } else if (kind === fastn_dom.PropertyKind.Opacity) {
            this.attachCss("opacity", staticValue);
        } else if (kind === fastn_dom.PropertyKind.Cursor) {
            this.attachCss("cursor", staticValue);
        } else if (kind === fastn_dom.PropertyKind.Resize) {
            // overflow: auto, resize: staticValue
            this.attachCss("resize", staticValue);
            this.attachCss("overflow", "auto");
        } else if (kind === fastn_dom.PropertyKind.MinHeight) {
            this.attachCss("min-height", staticValue);
        } else if (kind === fastn_dom.PropertyKind.MaxHeight) {
            this.attachCss("max-height", staticValue);
        } else if (kind === fastn_dom.PropertyKind.MinWidth) {
            this.attachCss("min-width", staticValue);
        } else if (kind === fastn_dom.PropertyKind.MaxWidth) {
            this.attachCss("max-width", staticValue);
        } else if (kind === fastn_dom.PropertyKind.WhiteSpace) {
            this.attachCss("white-space", staticValue);
        } else if (kind === fastn_dom.PropertyKind.AlignSelf) {
            this.attachCss("align-self", staticValue);
        } else if (kind === fastn_dom.PropertyKind.BorderColor) {
            this.attachColorCss("border-color", staticValue);
        } else if (kind === fastn_dom.PropertyKind.BorderLeftColor) {
            this.attachColorCss("border-left-color", staticValue);
        } else if (kind === fastn_dom.PropertyKind.BorderRightColor) {
            this.attachColorCss("border-right-color", staticValue);
        } else if (kind === fastn_dom.PropertyKind.BorderTopColor) {
            this.attachColorCss("border-top-color", staticValue);
        } else if (kind === fastn_dom.PropertyKind.BorderBottomColor) {
            this.attachColorCss("border-bottom-color", staticValue);
        } else if (kind === fastn_dom.PropertyKind.LinkColor) {
            this.attachLinkColor(staticValue);
        } else if (kind === fastn_dom.PropertyKind.Color) {
            this.attachColorCss("color", staticValue, true);
        } else if (kind === fastn_dom.PropertyKind.Background) {
            if (fastn_utils.isNull(staticValue)) {
                this.attachColorCss("background-color", staticValue);
                this.attachBackgroundImageCss(staticValue);
                this.attachLinearGradientCss(staticValue);
                return;
            }

            let backgroundType = staticValue[0];
            switch (backgroundType) {
                case fastn_dom.BackgroundStyle.Solid()[0]:
                    this.attachColorCss("background-color", staticValue[1]);
                    break;
                case fastn_dom.BackgroundStyle.Image()[0]:
                    this.attachBackgroundImageCss(staticValue[1]);
                    break;
                case fastn_dom.BackgroundStyle.LinearGradient()[0]:
                    this.attachLinearGradientCss(staticValue[1]);
                    break;
            }
        } else if (kind === fastn_dom.PropertyKind.Display) {
            this.attachCss("display", staticValue);
        } else if (kind === fastn_dom.PropertyKind.Checked) {
            switch (staticValue) {
                case "true":
                case true:
                    this.attachAttribute("checked", "");
                    break;
                case "false":
                case false:
                    this.removeAttribute("checked");
                    break;
                default:
                    this.attachAttribute("checked", staticValue);
            }
        } else if (kind === fastn_dom.PropertyKind.Enabled) {
            switch (staticValue) {
                case "false":
                case false:
                    this.attachAttribute("disabled", "");
                    break;
                case "true":
                case true:
                    this.removeAttribute("disabled");
                    break;
                default:
                    this.attachAttribute("disabled", staticValue);
            }
        } else if (kind === fastn_dom.PropertyKind.TextInputType) {
            this.attachAttribute("type", staticValue);
        } else if (kind === fastn_dom.PropertyKind.DefaultTextInputValue) {
            this.attachAttribute("value", staticValue);
        } else if (kind === fastn_dom.PropertyKind.InputMaxLength) {
            this.attachAttribute("maxlength", staticValue);
        } else if (kind === fastn_dom.PropertyKind.Placeholder) {
            this.attachAttribute("placeholder", staticValue);
        } else if (kind === fastn_dom.PropertyKind.Multiline) {
            switch (staticValue) {
                case "true":
                case true:
                    this.updateTagName("textarea");
                    break;
                case "false":
                case false:
                    this.updateTagName("input");
                    break;
            }
        } else if (kind === fastn_dom.PropertyKind.Link) {
            // Changing node type to `a` for link
            // todo: needs fix for image links
            this.updateToAnchor(staticValue);
        } else if (kind === fastn_dom.PropertyKind.LinkRel) {
            if (fastn_utils.isNull(staticValue)) {
                this.removeAttribute("rel");
            }
            let rel_list = staticValue.map(obj => fastn_utils.getStaticValue(obj.item));
            this.attachAttribute("rel", rel_list.join(" "));
        } else if (kind === fastn_dom.PropertyKind.OpenInNewTab) {
            // open_in_new_tab is boolean type
            switch (staticValue) {
              case 'true':
              case true:
                this.attachAttribute("target", "_blank");
                break;
              default:
                this.attachAttribute("target", staticValue);
            }
        } else if (kind === fastn_dom.PropertyKind.TextStyle) {
            let styles = staticValue?.map(obj => fastn_utils.getStaticValue(obj.item));
            this.attachTextStyles(styles);
        } else if (kind === fastn_dom.PropertyKind.Region) {
            this.updateTagName(staticValue);
            if (this.#node.innerHTML) {
                this.#node.id = fastn_utils.slugify(this.#rawInnerValue);
            }
        } else if (kind === fastn_dom.PropertyKind.AlignContent) {
            let node_kind = this.#kind;
            this.attachAlignContent(staticValue, node_kind);
        } else if (kind === fastn_dom.PropertyKind.Loading) {
            this.attachAttribute("loading", staticValue);
        } else if (kind === fastn_dom.PropertyKind.Src) {
            this.attachAttribute("src", staticValue);
        } else if (kind === fastn_dom.PropertyKind.ImageSrc) {
            ftd.dark_mode.addClosure(fastn.closure(() => {
                if (fastn_utils.isNull(staticValue)) {
                    this.attachAttribute("src", staticValue);
                    return;
                }
                const is_dark_mode = ftd.dark_mode.get();
                const src = staticValue.get(is_dark_mode ? 'dark' : 'light');
                if (!ssr) {
                    let image_node = this.#node;
                    if( image_node.nodeName.toLowerCase() === "a" ) {
                        let childNodes = image_node.childNodes;
                        childNodes.forEach(function(child) {
                            if (child.nodeName.toLowerCase() === "img")
                                image_node = child;
                        });
                    }
                    image_node.setAttribute("src", fastn_utils.getStaticValue(src));
                }
                else {
                    this.attachAttribute("src", fastn_utils.getStaticValue(src));
                }
            }).addNodeProperty(this, null, inherited));
            this.#mutables.push(ftd.dark_mode);
        } else if (kind === fastn_dom.PropertyKind.Alt) {
            this.attachAttribute("alt", staticValue);
        } else if (kind === fastn_dom.PropertyKind.VideoSrc) {
            ftd.dark_mode.addClosure(fastn.closure(() => {
                if (fastn_utils.isNull(staticValue)) {
                    this.attachAttribute("src", staticValue);
                    return;
                }
                const is_dark_mode = ftd.dark_mode.get();
                const src = staticValue.get(is_dark_mode ? 'dark' : 'light');

                this.attachAttribute("src", fastn_utils.getStaticValue(src));
            }).addNodeProperty(this, null, inherited));
            this.#mutables.push(ftd.dark_mode);
        } else if (kind === fastn_dom.PropertyKind.Autoplay) {
            if(staticValue) {
                this.attachAttribute("autoplay", staticValue);
            } else {
                this.removeAttribute("autoplay");
            }
        } else if (kind === fastn_dom.PropertyKind.Muted) {
            if(staticValue) {
                this.attachAttribute("muted", staticValue);
            } else {
                this.removeAttribute("muted");
            }
        } else if (kind === fastn_dom.PropertyKind.Controls) {
            if(staticValue) {
                this.attachAttribute("controls", staticValue);
            } else {
                this.removeAttribute("controls");
            }
        } else if (kind === fastn_dom.PropertyKind.LoopVideo) {
            if(staticValue) {
                this.attachAttribute("loop", staticValue);
            } else {
                this.removeAttribute("loop");
            }
        } else if (kind === fastn_dom.PropertyKind.Poster) {
            ftd.dark_mode.addClosure(fastn.closure(() => {
                if (fastn_utils.isNull(staticValue)) {
                    this.attachAttribute("poster", staticValue);
                    return;
                }
                const is_dark_mode = ftd.dark_mode.get();
                const posterSrc = staticValue.get(is_dark_mode ? 'dark' : 'light');

                this.attachAttribute("poster", fastn_utils.getStaticValue(posterSrc));
            }).addNodeProperty(this, null, inherited));
            this.#mutables.push(ftd.dark_mode);
        } else if (kind === fastn_dom.PropertyKind.Fit) {
            this.attachCss("object-fit", staticValue);
        } else if (kind === fastn_dom.PropertyKind.YoutubeSrc) {
            if (fastn_utils.isNull(staticValue)) {
                this.attachAttribute("src", staticValue);
                return;
            }
            const id_pattern = "^([a-zA-Z0-9_-]{11})$";
            let id = staticValue.match(id_pattern);
            if (!fastn_utils.isNull(id)) {
                this.attachAttribute("src", `https:\/\/youtube.com/embed/${id[0]}`);
            } else {
                this.attachAttribute("src", staticValue);
            }

        } else if (kind === fastn_dom.PropertyKind.Role) {
            this.attachRoleCss(staticValue);
        } else if (kind === fastn_dom.PropertyKind.Code) {
            if (!fastn_utils.isNull(staticValue)) {
                let {
                    modifiedText,
                    highlightedLines
                } = fastn_utils.findAndRemoveHighlighter(staticValue);
                if (highlightedLines.length !== 0) {
                    this.attachAttribute("data-line", highlightedLines);
                }
                staticValue = modifiedText;
            }
            let codeNode = this.#children[0].getNode();
            let codeText = fastn_utils.escapeHtmlInCode(staticValue);
            codeNode.innerHTML= codeText;
            this.#extraData.code = this.#extraData.code ? this.#extraData.code : {};
            fastn_utils.highlightCode(codeNode, this.#extraData.code);
        }  else if (kind === fastn_dom.PropertyKind.CodeShowLineNumber) {
            if (staticValue) {
                this.#node.classList.add("line-numbers");
            } else {
                this.#node.classList.remove("line-numbers");
            }
        } else if (kind === fastn_dom.PropertyKind.CodeTheme) {
            this.#extraData.code = this.#extraData.code ? this.#extraData.code : {};
            if(fastn_utils.isNull(staticValue)) {
                if(!fastn_utils.isNull(this.#extraData.code.theme)) {
                    this.#node.classList.remove(this.#extraData.code.theme);
                }
                return;
            }
            if (!ssr) {
                fastn_utils.addCodeTheme(staticValue);
            }
            staticValue = fastn_utils.getStaticValue(staticValue);
            let theme = staticValue.replace("\.", "-");
            if (this.#extraData.code.theme !== theme) {
                let codeNode = this.#children[0].getNode();
                this.#node.classList.remove(this.#extraData.code.theme);
                codeNode.classList.remove(this.#extraData.code.theme);
                this.#extraData.code.theme = theme;
                this.#node.classList.add(theme);
                codeNode.classList.add(theme);
                fastn_utils.highlightCode(codeNode, this.#extraData.code);
            }
        } else if (kind === fastn_dom.PropertyKind.CodeLanguage) {
            let language = `language-${staticValue}`;
            this.#extraData.code = this.#extraData.code ? this.#extraData.code : {};
            if (this.#extraData.code.language) {
                this.#node.classList.remove(language);
            }
            this.#extraData.code.language = language;
            this.#node.classList.add(language);
            let codeNode = this.#children[0].getNode();
            codeNode.classList.add(language);
            fastn_utils.highlightCode(codeNode, this.#extraData.code);
        } else if (kind === fastn_dom.PropertyKind.Favicon) {
            if (fastn_utils.isNull(staticValue)) return;
            this.setFavicon(staticValue);
        } else if (kind === fastn_dom.PropertyKind.DocumentProperties.MetaTitle) {
            this.updateMetaTitle(staticValue);
        } else if (kind === fastn_dom.PropertyKind.DocumentProperties.MetaOGTitle) {
            this.addMetaTagByProperty("og:title", staticValue);
        } else if (kind === fastn_dom.PropertyKind.DocumentProperties.MetaTwitterTitle) {
            this.addMetaTagByName("twitter:title", staticValue);
        } else if (kind === fastn_dom.PropertyKind.DocumentProperties.MetaDescription) {
            this.addMetaTagByName("description", staticValue);
        } else if (kind === fastn_dom.PropertyKind.DocumentProperties.MetaOGDescription) {
            this.addMetaTagByProperty("og:description", staticValue);
        } else if (kind === fastn_dom.PropertyKind.DocumentProperties.MetaTwitterDescription) {
            this.addMetaTagByName("twitter:description", staticValue);
        } else if (kind === fastn_dom.PropertyKind.DocumentProperties.MetaOGImage) {
            // staticValue is of ftd.raw-image-src RecordInstance type
            if (fastn_utils.isNull(staticValue)) {
                this.removeMetaTagByProperty("og:image");
                return;
            }
            this.addMetaTagByProperty("og:image", fastn_utils.getStaticValue(staticValue.get('src')));
        } else if (kind === fastn_dom.PropertyKind.DocumentProperties.MetaTwitterImage) {
            // staticValue is of ftd.raw-image-src RecordInstance type
            if (fastn_utils.isNull(staticValue)) {
                this.removeMetaTagByName("twitter:image");
                return;
            }
            this.addMetaTagByName("twitter:image", fastn_utils.getStaticValue(staticValue.get('src')));
        } else if (kind === fastn_dom.PropertyKind.DocumentProperties.MetaThemeColor) {
            // staticValue is of ftd.color RecordInstance type
            if (fastn_utils.isNull(staticValue)) {
                this.removeMetaTagByName("theme-color");
                return;
            }
            this.addMetaTagByName("theme-color", fastn_utils.getStaticValue(staticValue.get('light')));
        } else if (kind === fastn_dom.PropertyKind.IntegerValue
            || kind === fastn_dom.PropertyKind.DecimalValue
            || kind === fastn_dom.PropertyKind.BooleanValue) {
            this.#node.innerHTML = staticValue;
            this.#rawInnerValue = staticValue;
        } else if (kind === fastn_dom.PropertyKind.StringValue) {
            this.#rawInnerValue = staticValue;
            if (!ssr) {
                staticValue = fastn_utils.markdown_inline(staticValue);
                staticValue = fastn_utils.process_post_markdown(this.#node, staticValue);
            }
            this.#node.innerHTML = staticValue;
        } else {
            throw ("invalid fastn_dom.PropertyKind: " + kind);
        }
    }
    setProperty(kind, value, inherited) {
        if (value instanceof fastn.mutableClass) {
            this.setDynamicProperty(kind, [value], () => { return value.get(); }, inherited);
        } else if (value instanceof PropertyValueAsClosure) {
            this.setDynamicProperty(kind, value.deps, value.closureFunction, inherited);
        } else {
            this.setStaticProperty(kind, value, inherited);
        }
    }
    setDynamicProperty(kind, deps, func, inherited) {
        let closure = fastn.closure(func).addNodeProperty(this, kind, inherited);
        for (let dep in deps) {
            if (fastn_utils.isNull(deps[dep]) || !deps[dep].addClosure) {
                continue;
            }
            deps[dep].addClosure(closure);
            this.#mutables.push(deps[dep]);
        }
    }
    getNode() {
        return this.#node;
    }
    getExtraData() {
        return this.#extraData
    }
    getChildren() {
        return this.#children;
    }
    mergeFnCalls(current, newFunc) {
        return () => {
            if (current instanceof Function) current();
            if (newFunc instanceof Function) newFunc();
        };
    }
    addEventHandler(event, func) {
        if (event === fastn_dom.Event.Click) {
            let onclickEvents = this.mergeFnCalls(this.#node.onclick, func);
            if (fastn_utils.isNull(this.#node.onclick)) this.attachCss("cursor", "pointer");
            this.#node.onclick = onclickEvents;
        } else if (event === fastn_dom.Event.MouseEnter) {
            let mouseEnterEvents = this.mergeFnCalls(this.#node.onmouseenter, func);
            this.#node.onmouseenter = mouseEnterEvents;
        } else if (event === fastn_dom.Event.MouseLeave) {
            let mouseLeaveEvents = this.mergeFnCalls(this.#node.onmouseleave, func);
            this.#node.onmouseleave = mouseLeaveEvents;
        } else if (event === fastn_dom.Event.ClickOutside) {
            ftd.clickOutsideEvents.push([this, func]);
        } else if (!!event[0] && event[0] === fastn_dom.Event.GlobalKey()[0]) {
            ftd.globalKeyEvents.push([this, func, event[1]]);
        } else if (!!event[0] && event[0] === fastn_dom.Event.GlobalKeySeq()[0]) {
            ftd.globalKeySeqEvents.push([this, func, event[1]]);
        } else if (event === fastn_dom.Event.Input) {
            let onInputEvents = this.mergeFnCalls(this.#node.oninput, func);
            this.#node.oninput = onInputEvents;
        } else if (event === fastn_dom.Event.Change) {
            let onChangeEvents = this.mergeFnCalls(this.#node.onchange, func);
            this.#node.onchange = onChangeEvents;
        } else if (event === fastn_dom.Event.Blur) {
            let onBlurEvents = this.mergeFnCalls(this.#node.onblur, func);
            this.#node.onblur = onBlurEvents;
        } else if (event === fastn_dom.Event.Focus) {
            let onFocusEvents = this.mergeFnCalls(this.#node.onfocus, func);
            this.#node.onfocus = onFocusEvents;
        }
    }
    destroy() {
        for (let i = 0; i < this.#mutables.length; i++) {
            this.#mutables[i].unlinkNode(this);
        }
        // Todo: We don't need this condition as after destroying this node
        //  ConditionalDom reset this.#conditionUI to null or some different
        //  value. Not sure why this is still needed.
        if (!fastn_utils.isNull(this.#node)) {
            this.#node.remove();
        }
        this.#mutables = [];
        this.#parent = null;
        this.#node = null;
    }
}

class ConditionalDom {
    #marker;
    #parent;
    #node_constructor;
    #condition;
    #mutables;
    #conditionUI;

    constructor(parent, deps, condition, node_constructor) {
        this.#marker = fastn_dom.createKernel(parent, fastn_dom.ElementKind.Comment);
        this.#parent = parent;

        this.#conditionUI = null;
        let closure = fastn.closure(() => {
            fastn_utils.resetFullHeight();
            if (condition()) {
                if (this.#conditionUI) {
                    let conditionUI = fastn_utils.flattenArray(this.#conditionUI);
                    while (conditionUI.length > 0) {
                        let poppedElement = conditionUI.pop();
                        poppedElement.destroy();
                    }
                }
                this.#conditionUI = node_constructor(new ParentNodeWithSibiling(this.#parent, this.#marker));
                if (!Array.isArray(this.#conditionUI) && fastn_utils.isWrapperNode(this.#conditionUI.getTagName())) {
                    this.#conditionUI = this.#conditionUI.getChildren();
                }
            } else if (this.#conditionUI) {
                let conditionUI = fastn_utils.flattenArray(this.#conditionUI);
                while (conditionUI.length > 0) {
                    let poppedElement = conditionUI.pop();
                    poppedElement.destroy();
                }
                this.#conditionUI = null;
            }
            fastn_utils.setFullHeight();
        })
        deps.forEach(dep => {
            if (!fastn_utils.isNull(dep) && dep.addClosure) {
                dep.addClosure(closure);
            }
        });

        this.#node_constructor = node_constructor;
        this.#condition = condition;
        this.#mutables = [];
    }

    getParent() {
        let nodes =  [this.#marker];
        if (this.#conditionUI) {
            nodes.push(this.#conditionUI);
        }
        return nodes;
    }
}

fastn_dom.createKernel = function (parent, kind) {
    return new Node2(parent, kind);
}

fastn_dom.conditionalDom = function (parent, deps, condition, node_constructor) {
    return new ConditionalDom(parent, deps, condition, node_constructor);
}

class ParentNodeWithSibiling {
    #parent;
    #sibiling;
    constructor(parent, sibiling) {
        this.#parent = parent;
        this.#sibiling = sibiling;
    }
    getParent() {
        return this.#parent;
    }
    getSibiling() {
        return this.#sibiling;
    }
}

class ForLoop {
    #node_constructor;
    #list;
    #wrapper;
    #parent;
    #nodes;
    constructor(parent, node_constructor, list) {
        this.#wrapper = fastn_dom.createKernel(parent, fastn_dom.ElementKind.Comment);
        this.#parent = parent;
        this.#node_constructor = node_constructor;
        this.#list = list;
        this.#nodes = [];

        fastn_utils.resetFullHeight();
        for (let idx in list.getList()) {
            this.createNode(idx, false);
        }
        fastn_utils.setFullHeight();
    }
    createNode(index, resizeBodyHeight= true) {
        if (resizeBodyHeight) {
            fastn_utils.resetFullHeight();
        }
        let parentWithSibiling = new ParentNodeWithSibiling(this.#parent, this.#wrapper);
        if (index !== 0) {
            parentWithSibiling = new ParentNodeWithSibiling(this.#parent, this.#nodes[index-1]);
        }
        let v = this.#list.get(index);
        let node = this.#node_constructor(parentWithSibiling, v.item, v.index);
        this.#nodes.splice(index, 0, node);
        if (resizeBodyHeight) {
            fastn_utils.setFullHeight();
        }
        return node;
    }
    createAllNode() {
        fastn_utils.resetFullHeight();
        this.deleteAllNode(false);
        for (let idx in this.#list.getList()) {
            this.createNode(idx, false);
        }
        fastn_utils.setFullHeight();
    }
    deleteAllNode(resizeBodyHeight= true) {
        if (resizeBodyHeight) {
            fastn_utils.resetFullHeight();
        }
        while (this.#nodes.length > 0) {
            this.#nodes.pop().destroy();
        }
        if (resizeBodyHeight) {
            fastn_utils.setFullHeight();
        }
    }
    getWrapper() {
        return this.#wrapper;
    }
    deleteNode(index) {
        fastn_utils.resetFullHeight();
        let node = this.#nodes.splice(index, 1)[0];
        node.destroy();
        fastn_utils.setFullHeight();
    }
    getParent() {
        return this.#parent;
    }
}

fastn_dom.forLoop = function (parent, node_constructor, list) {
    return new ForLoop(parent, node_constructor, list);
}
let fastn_utils = {
    htmlNode(kind) {
        let node = "div";
        let css = [];
        let attributes = {};
        if (kind === fastn_dom.ElementKind.Column) {
            css.push("ft_column");
        } else if (kind === fastn_dom.ElementKind.Document) {
            css.push("ft_column");
            css.push("full");
        } else if (kind === fastn_dom.ElementKind.Row) {
            css.push("ft_row");
        } else if (kind === fastn_dom.ElementKind.IFrame) {
            node = "iframe";
            // To allow fullscreen support
            // Reference: https://stackoverflow.com/questions/27723423/youtube-iframe-embed-full-screen
            attributes["allowfullscreen"] = "";
        } else if (kind === fastn_dom.ElementKind.Image) {
            node = "img";
        } else if (kind === fastn_dom.ElementKind.Video) {
            node = "video";
        } else if (kind === fastn_dom.ElementKind.ContainerElement ||
            kind === fastn_dom.ElementKind.Text) {
            node = "div";
        } else if (kind === fastn_dom.ElementKind.Rive) {
            node = "canvas";
        } else if (kind === fastn_dom.ElementKind.CheckBox) {
            node = "input";
            attributes["type"] = "checkbox";
        } else if (kind === fastn_dom.ElementKind.TextInput) {
            node = "input";
        } else if (kind === fastn_dom.ElementKind.Comment) {
            node = fastn_dom.commentNode;
        } else if (kind === fastn_dom.ElementKind.Wrapper) {
            node = fastn_dom.wrapperNode;
        } else if (kind === fastn_dom.ElementKind.Code) {
           node = "pre";
        } else if (kind === fastn_dom.ElementKind.CodeChild) {
            node = "code";
        } else if (kind[0] === fastn_dom.ElementKind.WebComponent()[0]) {
            let [webcomponent, args] = kind[1];
            node = `${webcomponent}`;
            fastn_dom.webComponent.push(args);
            attributes[fastn_dom.webComponentArgument] = fastn_dom.webComponent.length - 1;
        }
        return [node, css, attributes];
    },
    getStaticValue(obj) {
        if (obj instanceof fastn.mutableClass) {
           return this.getStaticValue(obj.get());
        } else if (obj instanceof fastn.mutableListClass) {
            return obj.getList();
        }/*
        Todo: Make this work
        else if (obj instanceof fastn.recordInstanceClass) {
            return obj.getAllFields();
        }*/ else {
           return obj;
        }
    },
    getInheritedValues(default_args, inherited, function_args) {
        let record_fields = {
            "colors": ftd.default_colors.getClone().setAndReturn("is-root", true),
            "types": ftd.default_types.getClone().setAndReturn("is-root", true)
        }
        Object.assign(record_fields, default_args);
        let fields = {};
        if (inherited instanceof fastn.recordInstanceClass) {
            fields = inherited.getAllFields();
            if (fields["colors"].get("is-root")) {
               delete fields.colors;
            }
            if (fields["types"].get("is-root")) {
               delete fields.types;
            }
        }
        Object.assign(record_fields, fields);
        Object.assign(record_fields, function_args);
        return fastn.recordInstance({
              ...record_fields
        });
    },
    removeNonFastnClasses(node) {
        let classList = node.getNode().classList;
        let extraCodeData = node.getExtraData().code;
        let iterativeClassList = classList;
        if (ssr) {
            iterativeClassList = iterativeClassList.getClasses();
        }
        const classesToRemove = [];

        for (const className of iterativeClassList) {
            if (!className.startsWith('__') &&
                className !== extraCodeData?.language &&
                className !== extraCodeData?.theme
            ) {
                classesToRemove.push(className);
            }
        }

        for (const classNameToRemove of classesToRemove) {
            classList.remove(classNameToRemove);
        }
    },
    staticToMutables(obj) {
        if (!(obj instanceof fastn.mutableClass) &&
            !(obj instanceof fastn.mutableListClass) &&
            !(obj instanceof fastn.recordInstanceClass))
        {
            if (Array.isArray(obj)) {
                let list = [];
                for (let index in obj) {
                    list.push(fastn_utils.staticToMutables(obj[index]));
                }
                return fastn.mutableList(list);
            } else if (obj instanceof Object) {
                let fields = {};
                for (let objKey in obj) {
                    fields[objKey] = fastn_utils.staticToMutables(obj[objKey]);
                }
                return fastn.recordInstance(fields);
            } else {
                return fastn.mutable(obj);
            }
        } else {
            return obj;
        }
    },
    getFlattenStaticValue(obj) {
        let staticValue = fastn_utils.getStaticValue(obj);
        if (Array.isArray(staticValue)) {
            return staticValue.map(func =>
                fastn_utils.getFlattenStaticValue(func.item));
        } /*
        Todo: Make this work
        else if (typeof staticValue === 'object' && fastn_utils.isNull(staticValue)) {
            return Object.fromEntries(
                Object.entries(staticValue).map(([k,v]) =>
                    [k, fastn_utils.getFlattenStaticValue(v)]
                )
            );
        }*/
        return staticValue;
    },
    getter(value) {
        if (value instanceof fastn.mutableClass) {
            return value.get();
        } else {
            return value;
        }
    },
    // Todo: Merge getterByKey with getter
    getterByKey(value, index) {
        if (value instanceof fastn.mutableClass
            || value instanceof fastn.recordInstanceClass) {
            return value.get(index);
        } else if (value instanceof fastn.mutableListClass) {
            return value.get(index).item;
        } else {
            return value;
        }
    },
    setter(variable, value) {
        if (!fastn_utils.isNull(variable) && variable.set) {
           variable.set(value);
           return true;
        }
        return false;
    },
    defaultPropertyValue(_propertyValue) {
        return null;
    },
    sameResponsiveRole(desktop, mobile) {
       return (desktop.get("font_family") ===  mobile.get("font_family")) &&
       (desktop.get("letter_spacing") ===  mobile.get("letter_spacing")) &&
       (desktop.get("line_height") ===  mobile.get("line_height")) &&
       (desktop.get("size") ===  mobile.get("size")) &&
       (desktop.get("weight") ===  mobile.get("weight"));
    },
    getRoleValues(value) {
        return {
            "font-family": fastn_utils.getStaticValue(value.get("font_family")),
            "letter-spacing": fastn_utils.getStaticValue(value.get("letter_spacing")),
            "font-size": fastn_utils.getStaticValue(value.get("size")),
            "font-weight": fastn_utils.getStaticValue(value.get("weight")),
            "line-height": fastn_utils.getStaticValue(value.get("line_height")),
        };
    },
    clone(value) {
        if (value === null || value === undefined) {
            return value;
        }
        if (value instanceof fastn.mutableClass ||
            value instanceof fastn.mutableListClass )
        {
            return value.getClone();
        }
           if (value instanceof fastn.recordInstanceClass) {
            return value.getClone();
        }
        return value;
    },
    getListItem(value) {
        if (value === undefined){
            return null;
        }
        if (value instanceof Object && value.hasOwnProperty("item")) {
            value = value.item;
        }
        return value;
    },
    getEventKey(event) {
        if (65 <= event.keyCode && event.keyCode <= 90) {
            return String.fromCharCode(event.keyCode).toLowerCase();
        }
        else {
            return event.key;
        }
    },
    createNestedObject(currentObject, path, value) {
        const properties = path.split('.');

        for (let i = 0; i < properties.length - 1; i++) {
            let property = fastn_utils.private.addUnderscoreToStart(properties[i]);
            if (currentObject instanceof fastn.recordInstanceClass) {
                if (currentObject.get(property) === undefined) {
                    currentObject.set(property, fastn.recordInstance({}));
                }
                currentObject = currentObject.get(property).get();
            } else {
                if (!currentObject.hasOwnProperty(property)) {
                    currentObject[property] = fastn.recordInstance({});
                }
                currentObject = currentObject[property];
            }
        }

        const innermostProperty = properties[properties.length - 1];
        if (currentObject instanceof fastn.recordInstanceClass) {
            currentObject.set(innermostProperty, value)
        } else {
            currentObject[innermostProperty] = value;
        }
    },
    /**
     * Takes an input string and processes it as inline markdown using the
     * 'marked' library. The function removes the last occurrence of
     * wrapping <p> tags (i.e. <p> tag found at the end) from the result and
     * adjusts spaces around the content.
     *
     * @param {string} i - The input string to be processed as inline markdown.
     * @returns {string} - The processed string with inline markdown.
     */
    markdown_inline(i) {
        if (fastn_utils.isNull(i)) return;
        const { space_before, space_after } = fastn_utils.private.spaces(i);
        const o = (() => {
            let g = fastn_utils.private.replace_last_occurrence(marked.parse(i), "<p>", "");
            g = fastn_utils.private.replace_last_occurrence(g, "</p>", "");
            return g;
        })();
        return `${fastn_utils.private.repeated_space(space_before)}${o}${fastn_utils.private.repeated_space(space_after)}`;
    },

    process_post_markdown(node, body) {
        if (!ssr) {
            const divElement = document.createElement("div");
            divElement.innerHTML = body;

            const current_node = node;
            const colorClasses = Array.from(current_node.classList).filter(className => className.startsWith('__c'));
            const tableElements = Array.from(divElement.getElementsByTagName('table'));

            tableElements.forEach(table => {
                colorClasses.forEach(colorClass => {
                    table.classList.add(colorClass);
                });
            });
            body = divElement.innerHTML;
        }
        return body;
    },
    isNull(a) {
        return a === null || a === undefined;
    },
    isCommentNode(node) {
      return node === fastn_dom.commentNode;
    },
    isWrapperNode(node) {
        return node === fastn_dom.wrapperNode;
    },
    nextSibling(node, parent) {
        // For Conditional DOM
        while (Array.isArray(node)) {
            node = node[node.length-1];
        }
        if (node.nextSibling) {
          return node.nextSibling;
        }
        if (node.getNode && node.getNode().nextSibling !== undefined) {
            return node.getNode().nextSibling;
        }
        return parent.getChildren().indexOf(node.getNode()) + 1;
    },
    createNodeHelper(node, classes, attributes) {
        let tagName = node;
        let element = fastn_virtual.document.createElement(node);
        for (let key in attributes) {
            element.setAttribute(key, attributes[key])
        }
        for (let c in classes) {
            element.classList.add(classes[c]);
        }

        return [tagName, element];
    },
    addCssFile(url) {
        // Create a new link element
        const linkElement = document.createElement("link");

        // Set the attributes of the link element
        linkElement.rel = "stylesheet";
        linkElement.href = url;

        // Append the link element to the head section of the document
        document.head.appendChild(linkElement);
    },
    addCodeTheme(theme) {
        if (!fastn_dom.codeData.addedCssFile.includes(theme)) {
            let themeCssUrl = fastn_dom.codeData.availableThemes[theme];
            fastn_utils.addCssFile(themeCssUrl);
            fastn_dom.codeData.addedCssFile.push(theme);
        }
    },
    /**
     * Searches for highlighter occurrences in the text, removes them,
     * and returns the modified text along with highlighted line numbers.
     *
     * @param {string} text - The input text to process.
     * @returns {{ modifiedText: string, highlightedLines: number[] }}
     *   Object containing modified text and an array of highlighted line numbers.
     *
     * @example
     * const text = `/-- ftd.text: Hello ;; hello
     *
     * -- some-component: caption-value
     * attr-name: attr-value ;; <hl>
     *
     *
     * -- other-component: caption-value ;; <hl>
     * attr-name: attr-value`;
     *
     * const result = findAndRemoveHighlighter(text);
     * console.log(result.modifiedText);
     * console.log(result.highlightedLines);
     */
    findAndRemoveHighlighter(text) {
        const lines = text.split('\n');
        const highlighter = ';; <hl>';
        const result = {
            modifiedText: '',
            highlightedLines: ''
        };

        let highlightedLines = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const highlighterIndex = line.indexOf(highlighter);

            if (highlighterIndex !== -1) {
                highlightedLines.push(i + 1); // Adding 1 to convert to human-readable line numbers
                result.modifiedText += line.substring(0, highlighterIndex) + line.substring(highlighterIndex + highlighter.length) + '\n';
            } else {
                result.modifiedText += line + '\n';
            }
        }

        result.highlightedLines = fastn_utils.private.mergeNumbers(highlightedLines);

        return result;
    },
    getNodeValue(node) {
        return node.getNode().value;
    },
    setFullHeight() {
        if(!ssr) {
            document.body.style.height = `max(${document.documentElement.scrollHeight}px, 100%)`;
        }
    },
    resetFullHeight() {
        if(!ssr) {
            document.body.style.height = `100%`;
        }
    },
    highlightCode(codeElement, extraCodeData) {
        if (!ssr && !fastn_utils.isNull(extraCodeData.language) && !fastn_utils.isNull(extraCodeData.theme)) {
            Prism.highlightElement(codeElement);
        }
    },

    //Taken from: https://byby.dev/js-slugify-string
    slugify(str) {
        return String(str)
            .normalize('NFKD') // split accented characters into their base characters and diacritical marks
            .replace('.', '-')
            .replace(/[\u0300-\u036f]/g, '') // remove all the accents, which happen to be all in the \u03xx UNICODE block.
            .trim() // trim leading or trailing whitespace
            .toLowerCase() // convert to lowercase
            .replace(/[^a-z0-9 -]/g, '') // remove non-alphanumeric characters
            .replace(/\s+/g, '-') // replace spaces with hyphens
            .replace(/-+/g, '-'); // remove consecutive hyphens
    },

    getEventListeners(node) {
        return {
            onclick: node.onclick,
            onmouseleave: node.onmouseleave,
            onmouseenter: node.onmouseenter,
            oninput: node.oninput,
            onblur: node.onblur,
            onfocus: node.onfocus
        }
    },

    flattenArray(arr) {
        return fastn_utils.private.flattenArray([arr]);
    },
    toSnakeCase(value) {
        return value.trim().split('').map((v, i) => {
            const lowercased = v.toLowerCase();
            if(v == " ") {
              return "_";
            }
            if(v != lowercased && i > 0) {
                return `_${lowercased}`
            }
            return lowercased;
        }).join('');
    },

    escapeHtmlInCode(str) {
        return str.replace(/[<]/g, "&lt;");
    },

    escapeHtmlInMarkdown(str) {
        if(typeof str !== 'string') {
            return str;
        }

        let result = "";
        let ch_map = {
            '<': "&lt;",
            '>': "&gt;",
            '&': "&amp;",
            '"': "&quot;",
            "'": "&#39;",
            '/': "&#47;",
        };
        for (var i = 0; i < str.length; i++) {
            let current = str[i];
            result += ch_map[current] ?? current;
        }
        return result;
    },
}


fastn_utils.private = {
    flattenArray(arr) {
        return arr.reduce((acc, item) => {
            return acc.concat(Array.isArray(item) ? fastn_utils.private.flattenArray(item) : item);
        }, []);
    },
    /**
     * Helper function for `fastn_utils.markdown_inline` to find the number of
     * spaces before and after the content.
     *
     * @param {string} s - The input string.
     * @returns {Object} - An object with 'space_before' and 'space_after' properties
     * representing the number of spaces before and after the content.
     */
    spaces(s) {
        let space_before = 0;
        for (let i = 0; i < s.length; i++) {
            if (s[i] !== ' ') {
                space_before = i;
                break;
            }
            space_before = i + 1;
        }
        if (space_before === s.length) {
            return { space_before, space_after: 0 };
        }

        let space_after = 0;
        for (let i = s.length - 1; i >= 0; i--) {
            if (s[i] !== ' ') {
                space_after = s.length - 1 - i;
                break;
            }
            space_after = i + 1;
        }

        return { space_before, space_after };
    },
    /**
     * Helper function for `fastn_utils.markdown_inline` to replace the last
     * occurrence of a substring in a string.
     *
     * @param {string} s - The input string.
     * @param {string} old_word - The substring to be replaced.
     * @param {string} new_word - The replacement substring.
     * @returns {string} - The string with the last occurrence of 'old_word' replaced by 'new_word'.
     */
    replace_last_occurrence(s, old_word, new_word) {
        if (!s.includes(old_word)) {
            return s;
        }

        const idx = s.lastIndexOf(old_word);
        return s.slice(0, idx) + new_word + s.slice(idx + old_word.length);
    },
    /**
     * Helper function for `fastn_utils.markdown_inline` to generate a string
     * containing a specified number of spaces.
     *
     * @param {number} n - The number of spaces to be generated.
     * @returns {string} - A string with 'n' spaces concatenated together.
     */
    repeated_space(n) {
        return Array.from({ length: n }, () => ' ').join('');
    },
    /**
     * Merges consecutive numbers in a comma-separated list into ranges.
     *
     * @param {string} input - Comma-separated list of numbers.
     * @returns {string} Merged number ranges.
     *
     * @example
     * const input = '1,2,3,5,6,7,8,9,11';
     * const output = mergeNumbers(input);
     * console.log(output); // Output: '1-3,5-9,11'
     */
    mergeNumbers(numbers) {
        if (numbers.length === 0) {
            return "";
        }
        const mergedRanges = [];

        let start = numbers[0];
        let end = numbers[0];

        for (let i = 1; i < numbers.length; i++) {
            if (numbers[i] === end + 1) {
                end = numbers[i];
            } else {
                if (start === end) {
                    mergedRanges.push(start.toString());
                } else {
                    mergedRanges.push(`${start}-${end}`);
                }
                start = end = numbers[i];
            }
        }

        if (start === end) {
            mergedRanges.push(start.toString());
        } else {
            mergedRanges.push(`${start}-${end}`);
        }

        return mergedRanges.join(',');
    },
    addUnderscoreToStart(text) {
        if (/^\d/.test(text)) {
            return '_' + text;
        }
        return text;
    },
}


/*Object.prototype.get = function(index) {
    return this[index];
}*/
let fastn_virtual = {}

let id_counter = 0;
let hydrating = false;
let ssr = false;

class ClassList {
    #classes = [];
    add(item) {
        this.#classes.push(item);
    }

    remove(itemToRemove) {
        this.#classes.filter(item => item !== itemToRemove)
    }
    toString() {
        return this.#classes.join(' ');
    }
    getClasses() {
        return this.#classes;
    }
}

class Node {
    #id
    #tagName
    #children
    #attributes
    constructor(id, tagName) {
        this.#tagName = tagName;
        this.#id = id;
        this.classList = new ClassList();
        this.#children = [];
        this.#attributes = {};
        this.innerHTML = "";
        this.style = {};
        this.onclick = null;
    }
    appendChild(c) {
        this.#children.push(c);
    }

    insertBefore(node, index) {
        this.#children.splice(index, 0, node);
    }

    getChildren() {
        return this.#children;
    }

    setAttribute(attribute, value) {
        this.#attributes[attribute] = value;
    }

    getAttribute(attribute) {
        return this.#attributes[attribute];
    }

    removeAttribute(attribute) {
        if (attribute in this.#attributes) delete this.#attributes[attribute];
    }

    // Caution: This is only supported in ssr mode
    updateTagName(tagName) {
        this.#tagName = tagName;
    }
    // Caution: This is only supported in ssr mode
    toHtmlAsString() {
        const openingTag = `<${this.#tagName}${this.getDataIdString()}${this.getAttributesString()}${this.getClassString()}${this.getStyleString()}>`;
        const closingTag = `</${this.#tagName}>`;
        const innerHTML = fastn_utils.escapeHtmlInMarkdown(this.innerHTML);
        const childNodes = this.#children.map(child => child.toHtmlAsString()).join('');

        return `${openingTag}${innerHTML}${childNodes}${closingTag}`;
    }
    // Caution: This is only supported in ssr mode
    getDataIdString() {
        return ` data-id="${this.#id}"`;
    }
    // Caution: This is only supported in ssr mode
    getClassString() {
        const classList = this.classList.toString();
        return classList ? ` class="${classList}"` : '';
    }
    // Caution: This is only supported in ssr mode
    getStyleString() {
        const styleProperties = Object.entries(this.style)
            .map(([prop, value]) => `${prop}:${value}`)
            .join(';');
        return styleProperties ? ` style="${styleProperties}"` : '';
    }
    // Caution: This is only supported in ssr mode
    getAttributesString() {
        const nodeAttributes = Object.entries(this.#attributes)
            .map(([attribute, value]) => {
                if (value !== undefined && value !== null && value !== "") {
                    return `${attribute}=\"${value}\"`;
                }
                return `${attribute}`;
            }).join(' ');
        return nodeAttributes ? ` ${nodeAttributes}` : '';
    }
}

class Document2 {
    createElement(tagName) {
        id_counter++;

        if (ssr) {
            return new Node(id_counter, tagName);
        }

        if (tagName === "body") {
            return window.document.body;
        }

        if (fastn_utils.isWrapperNode(tagName)) {
            return window.document.createComment(fastn_dom.commentMessage);
        }
        if (hydrating) {
            let node = this.getElementByDataID(id_counter);
            if (fastn_utils.isCommentNode(tagName)) {
                let comment= window.document.createComment(fastn_dom.commentMessage);
                node.parentNode.replaceChild(comment, node);
                return comment;
            }
            return node;
        } else {
            if (fastn_utils.isCommentNode(tagName)) {
                return window.document.createComment(fastn_dom.commentMessage);
            }
            return window.document.createElement(tagName);
        }
    }

    getElementByDataID(id) {
        return window.document.querySelector(`[data-id=\"${id}\"]`);
    }
}

fastn_virtual.document = new Document2();



fastn_virtual.hydrate = function(main) {
    hydrating = true;
    let body = fastn_virtual.document.createElement("body");
    main(body);
    id_counter = 0;
    hydrating = false;
}

fastn_virtual.ssr = function(main) {
    ssr = true;
    let body = fastn_virtual.document.createElement("body");
    main(body)
    ssr = false;
    id_counter = 0;
    return body.toHtmlAsString() + fastn_dom.getClassesAsString();
}
let ftd = {
    // source: https://stackoverflow.com/questions/400212/ (cc-by-sa)
    riveNodes: {},
    is_empty(value) {
        value = fastn_utils.getFlattenStaticValue(value);
        return fastn_utils.isNull(value) || value.length === 0;
    },

    len(data) {
        if (!!data && data instanceof fastn.mutableListClass) {
            if (data.getLength)
                return data.getLength();
            return -1;
        }
        if (!!data && data instanceof fastn.mutableClass) {
            let inner_data = data.get();
            return ftd.len(inner_data);
        }
        if (!!data && data.length) {
            return data.length;
        }
        return -2;
    },

    copy_to_clipboard(args) {
        let text = args.a;
        if (text instanceof fastn.mutableClass) text = fastn_utils.getStaticValue(text);
        if (text.startsWith("\\", 0)) {
            text = text.substring(1);
        }
        if (!navigator.clipboard) {
            fallbackCopyTextToClipboard(text);
            return;
        }
        navigator.clipboard.writeText(text).then(function() {
            console.log('Async: Copying to clipboard was successful!');
        }, function(err) {
            console.error('Async: Could not copy text: ', err);
        });
    },

    // Todo: Implement this (Remove highlighter)
    clean_code(args) {
        return args.a;
    },

    set_rive_boolean(args, node) {
        if (!!args.rive) {
            let riveNode = ftd.riveNodes[`${args.rive}__${ftd.device.get()}`];
            node = riveNode ? riveNode: node;
        }
        let riveConst = node.getExtraData().rive;
        const stateMachineName = riveConst.stateMachineNames[0];
        const inputs = riveConst.stateMachineInputs(stateMachineName);
        const bumpTrigger = inputs.find(i => i.name === args.input);
        bumpTrigger.value = args.value;
    },

    toggle_rive_boolean(args, node) {
        if (!!args.rive) {
            let riveNode = ftd.riveNodes[`${args.rive}__${ftd.device.get()}`];
            node = riveNode ? riveNode: node;
        }
        let riveConst = node.getExtraData().rive;
        const stateMachineName = riveConst.stateMachineNames[0];
        const inputs = riveConst.stateMachineInputs(stateMachineName);
        const trigger = inputs.find(i => i.name === args.input);
        trigger.value = !trigger.value;
    },

    set_rive_integer(args, node) {
        if (!!args.rive) {
            let riveNode = ftd.riveNodes[`${args.rive}__${ftd.device.get()}`];
            node = riveNode ? riveNode: node;
        }
        let riveConst = node.getExtraData().rive;
        const stateMachineName = riveConst.stateMachineNames[0];
        const inputs = riveConst.stateMachineInputs(stateMachineName);
        const trigger = inputs.find(i => i.name === args.input);
        trigger.value = args.value;
    },

    fire_rive(args, node) {
        if (!!args.rive) {
            let riveNode = ftd.riveNodes[`${args.rive}__${ftd.device.get()}`];
            node = riveNode ? riveNode: node;
        }
        let riveConst = node.getExtraData().rive;
        const stateMachineName = riveConst.stateMachineNames[0];
        const inputs = riveConst.stateMachineInputs(stateMachineName);
        const trigger = inputs.find(i => i.name === args.input);
        trigger.fire();
    },

    play_rive(args, node) {
        if (!!args.rive) {
            let riveNode = ftd.riveNodes[`${args.rive}__${ftd.device.get()}`];
            node = riveNode ? riveNode: node;
        }
        node.getExtraData().rive.play(args.input);
    },

    pause_rive(args, node) {
        if (!!args.rive) {
            let riveNode = ftd.riveNodes[`${args.rive}__${ftd.device.get()}`];
            node = riveNode ? riveNode: node;
        }
        node.getExtraData().rive.pause(args.input);
    },

    toggle_play_rive(args, node) {
        if (!!args.rive) {
            let riveNode = ftd.riveNodes[`${args.rive}__${ftd.device.get()}`];
            node = riveNode ? riveNode: node;
        }
        let riveConst = node.getExtraData().rive
        riveConst.playingAnimationNames.includes(args.input)
            ? riveConst.pause(args.input)
            : riveConst.play(args.input);
    },

    get(value, index) {
         return fastn_utils.getStaticValue(fastn_utils.getterByKey(value, index));
    },

    component_data(component) {
        let attributesIndex = component.getAttribute(fastn_dom.webComponentArgument);
        let attributes = fastn_dom.webComponent[attributesIndex];
        return Object.fromEntries(
            Object.entries(attributes).map(([k,v]) => {
                // Todo: check if argument is mutable reference or not
                    if (v instanceof fastn.mutableClass) {
                        v = fastn.webComponentVariable.mutable(v);
                    } else if (v instanceof fastn.mutableListClass) {
                        v = fastn.webComponentVariable.mutableList(v);
                    } else if (v instanceof fastn.recordInstanceClass) {
                        v = fastn.webComponentVariable.record(v);
                    } else {
                        v = fastn.webComponentVariable.static(v);
                    }
                    return [k, v];
                }
            )
        );
    }
};

// ftd.append($a = $people, v = Tom)
ftd.append = function (list, item) { list.push(item) }
ftd.pop = function (list) { list.pop() }
ftd.insert_at = function (list, index, item) { list.insertAt(index, item) }
ftd.delete_at = function (list, index) { list.deleteAt(index) }
ftd.clear_all = function (list) { list.clearAll() }
ftd.clear = ftd.clear_all;
ftd.set_list = function (list, value) { list.set(value) }

ftd.http = function (url, method, body, headers) {
    if (url instanceof fastn.mutableClass) url = url.get();
    if (method instanceof fastn.mutableClass) method = method.get();
    method = method.trim().toUpperCase();
    const init = {
        method,
        headers: {}
    };
    if(headers && headers instanceof fastn.recordInstanceClass) {
        Object.assign(init.headers, headers.toObject());
    }
    if(method !== 'GET') {
        init.headers['Content-Type'] = 'application/json';
    }
    if(body && body instanceof fastn.recordInstanceClass && method !== 'GET') {
        init.body = JSON.stringify(body.toObject());
    }
    fetch(url, init)
    .then(res => {
        if(!res.ok) {
            return new Error("[http]: Request failed", res)
        }

        return res.json();
    })
    .then(json => {
        console.log("[http]: Response OK", json);
    })
    .catch(console.error);
}

ftd.navigate = function(url, request_data) {
    let query_parameters = new URLSearchParams();
    if(request_data instanceof RecordInstance) {
        // @ts-ignore
        for (let [header, value] of Object.entries(request_data.toObject())) {
            if (header != "url" && header != "function" && header != "method") {
                let [key, val] = value.length == 2 ? value : [header, value];
                query_parameters.set(key, val);
            }
        }
    }
    let query_string = query_parameters.toString();
    if (query_string) {
        let get_url = url + "?" + query_parameters.toString();
        window.location.href = get_url;
    }
    else {
        window.location.href = url;
    }
}

ftd.toggle_dark_mode = function () {
    const is_dark_mode = ftd.get(ftd.dark_mode);
    if(is_dark_mode) {
        enable_light_mode();
    } else {
        enable_dark_mode();
    }
};

const len = ftd.len;

ftd.local_storage = {
    _get_key(key) {
        if (key instanceof fastn.mutableClass) {
            key = key.get();
        }
        const packageNamePrefix = __fastn_package_name__ ? `${__fastn_package_name__}_` : "";
        const snakeCaseKey = fastn_utils.toSnakeCase(key);
    
        return `${packageNamePrefix}${snakeCaseKey}`;
    },
    set(key, value) {
        key = this._get_key(key);
        value = fastn_utils.getFlattenStaticValue(value);
        localStorage.setItem(key, value && typeof value === 'object' ? JSON.stringify(value) : value);
    },
    get(key) {
        key = this._get_key(key);
        if(ssr && !hydrating) {
            return;
        }
        const item = localStorage.getItem(key);
        if(!item) {
            return;
        }
        try {
            const obj = JSON.parse(item);

            return fastn_utils.staticToMutables(obj);
        } catch {
            return item;
        }
    },
    delete(key) {
        key = this._get_key(key);
        localStorage.removeItem(key);
    }
}
class MutableVariable {
    #value;
    constructor(value) {
        this.#value = value;
    }

    get() {
        return fastn_utils.getStaticValue(this.#value);
    }

    set(value) {
        this.#value.set(value);
    }
    // Todo: Remove closure when node is removed.
    on_change(func) {
        this.#value.addClosure(fastn.closureWithoutExecute(func));
    }
}

class MutableListVariable {
    #value;
    constructor(value) {
        this.#value = value;
    }
    get() {
        return fastn_utils.getStaticValue(this.#value);
    }
    set(index, list) {
        if (list === undefined) {
            this.#value.set(fastn_utils.staticToMutables(index));
            return;
        }
        this.#value.set(index, fastn_utils.staticToMutables(list));
    }
    insertAt(index, value) {
        this.#value.insertAt(index, fastn_utils.staticToMutables(value))
    }
    deleteAt(index) {
        this.#value.deleteAt(index);
    }
    push(value) {
        this.#value.push(value);
    }
    pop() {
        this.#value.pop()
    }
    clearAll() {
        this.#value.clearAll()
    }
    on_change(func) {
        this.#value.addClosure(fastn.closureWithoutExecute(func));
    }
}

class RecordVariable {
    #value;
    constructor(value) {
        this.#value = value;
    }

    get() {
        return fastn_utils.getStaticValue(this.#value);
    }

    set(record) {
        this.#value.set(fastn_utils.staticToMutables(record));
    }

    on_change(func) {
        this.#value.addClosure(fastn.closureWithoutExecute(func));
    }
}
class StaticVariable {
    #value;
    #closures;
    constructor(value) {
        this.#value = value;
        this.#closures = [];
        if (this.#value instanceof fastn.mutableClass) {
            this.#value.addClosure(fastn.closure(() => this.#closures.forEach((closure) => closure.update())));
        }
    }

    get() {
        return fastn_utils.getStaticValue(this.#value);
    }

    on_change(func) {
        if (this.#value instanceof fastn.mutableClass) {
            this.#value.addClosure(fastn.closure(func));
        }
    }
}

fastn.webComponentVariable =  {
    mutable: (value) => {
        return new MutableVariable(value);
    },
    mutableList: (value) => {
        return new MutableListVariable(value);
    },
    static: (value) => {
        return new StaticVariable(value);
    },
    record: (value) => {
        return new RecordVariable(value);
    },
}
ftd.clickOutsideEvents = [];
ftd.globalKeyEvents = [];
ftd.globalKeySeqEvents = [];

ftd.post_init = function () {
    const DARK_MODE_COOKIE = "fastn-dark-mode";
    const COOKIE_SYSTEM_LIGHT = "system-light";
    const COOKIE_SYSTEM_DARK = "system-dark";
    const COOKIE_DARK_MODE = "dark";
    const COOKIE_LIGHT_MODE = "light";
    const DARK_MODE_CLASS = "dark";
    const MOBILE_CLASS = "mobile";
    let last_device = "desktop";

    window.onresize = function () {
        initialise_device()
    };
    function initialise_click_outside_events() {
        document.addEventListener("click", function (event) {
            ftd.clickOutsideEvents.forEach(([ftdNode, func]) => {
                let node = ftdNode.getNode();
                if (!!node && node.style.display !== "none" && !node.contains(event.target)) {
                    func();
                }
            })
        })
    }
    function initialise_global_key_events() {
        let globalKeys = {};
        let buffer = [];
        let lastKeyTime = Date.now();

        document.addEventListener("keydown", function (event) {
            let eventKey =  fastn_utils.getEventKey(event);
            globalKeys[eventKey] = true;
            const currentTime = Date.now();
            if (currentTime - lastKeyTime > 1000) {
                buffer = [];
            }
            lastKeyTime = currentTime;
            if ((event.target.nodeName === "INPUT" || event.target.nodeName === "TEXTAREA")
            && (eventKey !== "ArrowDown" && eventKey !== "ArrowUp" &&
                    eventKey !== "ArrowRight" && eventKey !== "ArrowLeft")
             && (event.target.nodeName === "INPUT" && eventKey !== "Enter")) {
                return;
            }
            buffer.push(eventKey);

            ftd.globalKeyEvents.forEach(([_ftdNode, func, array]) => {
                let globalKeysPresent = array.reduce((accumulator, currentValue) => accumulator && !!globalKeys[currentValue], true);
                if (globalKeysPresent && buffer.join(',').includes(array.join(','))) {
                    func();
                    globalKeys[eventKey] = false;
                    buffer = [];
                }
                return;
            })

            ftd.globalKeySeqEvents.forEach(([_ftdNode, func, array]) => {
                if (buffer.join(',').includes(array.join(','))) {
                    func();
                    globalKeys[eventKey] = false;
                    buffer = [];
                }
                return;
            })
        })

        document.addEventListener("keyup", function(event) {
            globalKeys[fastn_utils.getEventKey(event)] = false;
        })
    }
    function initialise_device() {
        let current = get_device();
        if (current === last_device) {
            return;
        }
        console.log("last_device", last_device, "current_device", current);
        ftd.device.set(current);
        last_device = current;
    }

    function get_device() {
        // not at all sure about this function logic.
        let width = window.innerWidth;
        // In the future, we may want to have more than one break points, and
        // then we may also want the theme builders to decide where the
        // breakpoints should go. we should be able to fetch fpm variables
        // here, or maybe simply pass the width, user agent etc. to fpm and
        // let people put the checks on width user agent etc., but it would
        // be good if we can standardize few breakpoints. or maybe we should
        // do both, some standard breakpoints and pass the raw data.
        // we would then rename this function to detect_device() which will
        // return one of "desktop", "mobile". and also maybe have another
        // function detect_orientation(), "landscape" and "portrait" etc.,
        // and instead of setting `ftd#mobile: boolean` we set `ftd#device`
        // and `ftd#view-port-orientation` etc.
        let mobile_breakpoint = fastn_utils.getStaticValue(ftd.breakpoint_width.get("mobile"));
        if (width <= mobile_breakpoint) {
            document.body.classList.add(MOBILE_CLASS);
            return fastn_dom.DeviceData.Mobile;
        }
        if (document.body.classList.contains(MOBILE_CLASS)) {
            document.body.classList.remove(MOBILE_CLASS);
        }
        return fastn_dom.DeviceData.Desktop;
    }

    /*
        ftd.dark-mode behaviour:

        ftd.dark-mode is a boolean, default false, it tells the UI to show
        the UI in dark or light mode. Themes should use this variable to decide
        which mode to show in UI.

        ftd.follow-system-dark-mode, boolean, default true, keeps track if
        we are reading the value of `dark-mode` from system preference, or user
        has overridden the system preference.

        These two variables must not be set by ftd code directly, but they must
        use `$on-click$: message-host enable-dark-mode`, to ignore system
        preference and use dark mode. `$on-click$: message-host
        disable-dark-mode` to ignore system preference and use light mode and
        `$on-click$: message-host follow-system-dark-mode` to ignore user
        preference and start following system preference.

        we use a cookie: `ftd-dark-mode` to store the preference. The cookie can
        have three values:

           cookie missing /          user wants us to honour system preference
               system-light          and currently its light.

           system-dark               follow system and currently its dark.

           light:                    user prefers light

           dark:                     user prefers light

        We use cookie instead of localstorage so in future `fpm-repo` can see
        users preferences up front and renders the HTML on service wide
        following user's preference.

     */
    window.enable_dark_mode = function () {
        // TODO: coalesce the two set_bool-s into one so there is only one DOM
        //       update
        ftd.dark_mode.set(true);
        ftd.follow_system_dark_mode.set(false);
        ftd.system_dark_mode.set(system_dark_mode());
        document.body.classList.add(DARK_MODE_CLASS);
        set_cookie(DARK_MODE_COOKIE, COOKIE_DARK_MODE);
    };
    window.enable_light_mode = function () {
        // TODO: coalesce the two set_bool-s into one so there is only one DOM
        //       update
        ftd.dark_mode.set(false);
        ftd.follow_system_dark_mode.set(false);
        ftd.system_dark_mode.set(system_dark_mode());
        if (document.body.classList.contains(DARK_MODE_CLASS)) {
            document.body.classList.remove(DARK_MODE_CLASS);
        }
        set_cookie(DARK_MODE_COOKIE, COOKIE_LIGHT_MODE);
    };
    window.enable_system_mode = function () {
        // TODO: coalesce the two set_bool-s into one so there is only one DOM
        //       update
        let systemMode = system_dark_mode();
        ftd.follow_system_dark_mode.set(true);
        ftd.system_dark_mode.set(systemMode);
        if (systemMode) {
            ftd.dark_mode.set(true);
            document.body.classList.add(DARK_MODE_CLASS);
            set_cookie(DARK_MODE_COOKIE, COOKIE_SYSTEM_DARK);
        }
        else {
            ftd.dark_mode.set(false);
            if (document.body.classList.contains(DARK_MODE_CLASS)) {
                document.body.classList.remove(DARK_MODE_CLASS);
            }
            set_cookie(DARK_MODE_COOKIE, COOKIE_SYSTEM_LIGHT);
        }
    };
    function set_cookie(name, value) {
        document.cookie = name + "=" + value + "; path=/";
    }
    function system_dark_mode() {
        return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    function initialise_dark_mode() {
        update_dark_mode();
        start_watching_dark_mode_system_preference();
    }
    function get_cookie(name, def) {
        // source: https://stackoverflow.com/questions/5639346/
        let regex = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
        return regex !== null ? regex.pop() : def;
    }
    function update_dark_mode() {
        let current_dark_mode_cookie = get_cookie(DARK_MODE_COOKIE, COOKIE_SYSTEM_LIGHT);
        switch (current_dark_mode_cookie) {
            case COOKIE_SYSTEM_LIGHT:
            case COOKIE_SYSTEM_DARK:
                window.enable_system_mode();
                break;
            case COOKIE_LIGHT_MODE:
                window.enable_light_mode();
                break;
            case COOKIE_DARK_MODE:
                window.enable_dark_mode();
                break;
            default:
                console_log("cookie value is wrong", current_dark_mode_cookie);
                window.enable_system_mode();
        }
    }
    function start_watching_dark_mode_system_preference() {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener("change", update_dark_mode);
    }
    initialise_dark_mode();
    initialise_device();
    initialise_click_outside_events();
    initialise_global_key_events();
    fastn_utils.resetFullHeight();
    fastn_utils.setFullHeight();
}

window.ftd = ftd;

ftd.toggle = function (args) {
  let __fastn_super_package_name__ = __fastn_package_name__;
  __fastn_package_name__ = "amitu_github_io_dotcom";
  try {
    let __args__ = args;
    let fastn_utils_val___args___a = fastn_utils.clone(!fastn_utils.getter(__args__.a));
    if (fastn_utils_val___args___a instanceof fastn.mutableClass) {
      fastn_utils_val___args___a = fastn_utils_val___args___a.get();
    }
    if (!fastn_utils.setter(__args__.a, fastn_utils_val___args___a)) {
      __args__.a = fastn_utils_val___args___a;
    }
  } finally {
    __fastn_package_name__ = __fastn_super_package_name__;
  }
}
ftd.increment = function (args) {
  let __fastn_super_package_name__ = __fastn_package_name__;
  __fastn_package_name__ = "amitu_github_io_dotcom";
  try {
    let __args__ = args;
    let fastn_utils_val___args___a = fastn_utils.clone(fastn_utils.getter(__args__.a) + 1);
    if (fastn_utils_val___args___a instanceof fastn.mutableClass) {
      fastn_utils_val___args___a = fastn_utils_val___args___a.get();
    }
    if (!fastn_utils.setter(__args__.a, fastn_utils_val___args___a)) {
      __args__.a = fastn_utils_val___args___a;
    }
  } finally {
    __fastn_package_name__ = __fastn_super_package_name__;
  }
}
ftd.increment_by = function (args) {
  let __fastn_super_package_name__ = __fastn_package_name__;
  __fastn_package_name__ = "amitu_github_io_dotcom";
  try {
    let __args__ = args;
    let fastn_utils_val___args___a = fastn_utils.clone(fastn_utils.getter(__args__.a) + fastn_utils.getter(__args__.v));
    if (fastn_utils_val___args___a instanceof fastn.mutableClass) {
      fastn_utils_val___args___a = fastn_utils_val___args___a.get();
    }
    if (!fastn_utils.setter(__args__.a, fastn_utils_val___args___a)) {
      __args__.a = fastn_utils_val___args___a;
    }
  } finally {
    __fastn_package_name__ = __fastn_super_package_name__;
  }
}
ftd.enable_light_mode = function (args) {
  let __fastn_super_package_name__ = __fastn_package_name__;
  __fastn_package_name__ = "amitu_github_io_dotcom";
  try {
    let __args__ = args;
    return (enable_light_mode());
  } finally {
    __fastn_package_name__ = __fastn_super_package_name__;
  }
}
ftd.enable_dark_mode = function (args) {
  let __fastn_super_package_name__ = __fastn_package_name__;
  __fastn_package_name__ = "amitu_github_io_dotcom";
  try {
    let __args__ = args;
    return (enable_dark_mode());
  } finally {
    __fastn_package_name__ = __fastn_super_package_name__;
  }
}
ftd.enable_system_mode = function (args) {
  let __fastn_super_package_name__ = __fastn_package_name__;
  __fastn_package_name__ = "amitu_github_io_dotcom";
  try {
    let __args__ = args;
    return (enable_system_mode());
  } finally {
    __fastn_package_name__ = __fastn_super_package_name__;
  }
}
ftd.set_bool = function (args) {
  let __fastn_super_package_name__ = __fastn_package_name__;
  __fastn_package_name__ = "amitu_github_io_dotcom";
  try {
    let __args__ = args;
    let fastn_utils_val___args___a = fastn_utils.clone(__args__.v);
    if (fastn_utils_val___args___a instanceof fastn.mutableClass) {
      fastn_utils_val___args___a = fastn_utils_val___args___a.get();
    }
    if (!fastn_utils.setter(__args__.a, fastn_utils_val___args___a)) {
      __args__.a = fastn_utils_val___args___a;
    }
  } finally {
    __fastn_package_name__ = __fastn_super_package_name__;
  }
}
ftd.set_boolean = function (args) {
  let __fastn_super_package_name__ = __fastn_package_name__;
  __fastn_package_name__ = "amitu_github_io_dotcom";
  try {
    let __args__ = args;
    let fastn_utils_val___args___a = fastn_utils.clone(__args__.v);
    if (fastn_utils_val___args___a instanceof fastn.mutableClass) {
      fastn_utils_val___args___a = fastn_utils_val___args___a.get();
    }
    if (!fastn_utils.setter(__args__.a, fastn_utils_val___args___a)) {
      __args__.a = fastn_utils_val___args___a;
    }
  } finally {
    __fastn_package_name__ = __fastn_super_package_name__;
  }
}
ftd.set_string = function (args) {
  let __fastn_super_package_name__ = __fastn_package_name__;
  __fastn_package_name__ = "amitu_github_io_dotcom";
  try {
    let __args__ = args;
    let fastn_utils_val___args___a = fastn_utils.clone(__args__.v);
    if (fastn_utils_val___args___a instanceof fastn.mutableClass) {
      fastn_utils_val___args___a = fastn_utils_val___args___a.get();
    }
    if (!fastn_utils.setter(__args__.a, fastn_utils_val___args___a)) {
      __args__.a = fastn_utils_val___args___a;
    }
  } finally {
    __fastn_package_name__ = __fastn_super_package_name__;
  }
}
ftd.set_integer = function (args) {
  let __fastn_super_package_name__ = __fastn_package_name__;
  __fastn_package_name__ = "amitu_github_io_dotcom";
  try {
    let __args__ = args;
    let fastn_utils_val___args___a = fastn_utils.clone(__args__.v);
    if (fastn_utils_val___args___a instanceof fastn.mutableClass) {
      fastn_utils_val___args___a = fastn_utils_val___args___a.get();
    }
    if (!fastn_utils.setter(__args__.a, fastn_utils_val___args___a)) {
      __args__.a = fastn_utils_val___args___a;
    }
  } finally {
    __fastn_package_name__ = __fastn_super_package_name__;
  }
}
ftd.dark_mode = fastn.mutable(false);
ftd.empty = "";
ftd.space = " ";
ftd.nbsp = "&nbsp;";
ftd.non_breaking_space = "&nbsp;";
ftd.system_dark_mode = fastn.mutable(false);
ftd.follow_system_dark_mode = fastn.mutable(true);
ftd.font_display = fastn.mutable("sans-serif");
ftd.font_copy = fastn.mutable("sans-serif");
ftd.font_code = fastn.mutable("sans-serif");
ftd.default_types = fastn.recordInstance({
  heading_large: fastn.recordInstance({
    desktop: fastn.recordInstance({
      font_family: ftd.font_display,
      line_height: fastn_dom.FontSize.Px(65),
      size: fastn_dom.FontSize.Px(50),
      weight: 400
    }),
    mobile: fastn.recordInstance({
      font_family: ftd.font_display,
      line_height: fastn_dom.FontSize.Px(54),
      size: fastn_dom.FontSize.Px(36),
      weight: 400
    })
  }),
  heading_medium: fastn.recordInstance({
    desktop: fastn.recordInstance({
      font_family: ftd.font_display,
      line_height: fastn_dom.FontSize.Px(57),
      size: fastn_dom.FontSize.Px(38),
      weight: 400
    }),
    mobile: fastn.recordInstance({
      font_family: ftd.font_display,
      line_height: fastn_dom.FontSize.Px(40),
      size: fastn_dom.FontSize.Px(26),
      weight: 400
    })
  }),
  heading_small: fastn.recordInstance({
    desktop: fastn.recordInstance({
      font_family: ftd.font_display,
      line_height: fastn_dom.FontSize.Px(31),
      size: fastn_dom.FontSize.Px(24),
      weight: 400
    }),
    mobile: fastn.recordInstance({
      font_family: ftd.font_display,
      line_height: fastn_dom.FontSize.Px(29),
      size: fastn_dom.FontSize.Px(22),
      weight: 400
    })
  }),
  heading_hero: fastn.recordInstance({
    desktop: fastn.recordInstance({
      font_family: ftd.font_display,
      line_height: fastn_dom.FontSize.Px(104),
      size: fastn_dom.FontSize.Px(80),
      weight: 400
    }),
    mobile: fastn.recordInstance({
      font_family: ftd.font_display,
      line_height: fastn_dom.FontSize.Px(64),
      size: fastn_dom.FontSize.Px(48),
      weight: 400
    })
  }),
  heading_tiny: fastn.recordInstance({
    desktop: fastn.recordInstance({
      font_family: ftd.font_display,
      line_height: fastn_dom.FontSize.Px(26),
      size: fastn_dom.FontSize.Px(20),
      weight: 400
    }),
    mobile: fastn.recordInstance({
      font_family: ftd.font_display,
      line_height: fastn_dom.FontSize.Px(24),
      size: fastn_dom.FontSize.Px(18),
      weight: 400
    })
  }),
  copy_small: fastn.recordInstance({
    desktop: fastn.recordInstance({
      font_family: ftd.font_copy,
      line_height: fastn_dom.FontSize.Px(24),
      size: fastn_dom.FontSize.Px(14),
      weight: 400
    }),
    mobile: fastn.recordInstance({
      font_family: ftd.font_copy,
      line_height: fastn_dom.FontSize.Px(16),
      size: fastn_dom.FontSize.Px(12),
      weight: 400
    })
  }),
  copy_regular: fastn.recordInstance({
    desktop: fastn.recordInstance({
      font_family: ftd.font_copy,
      line_height: fastn_dom.FontSize.Px(30),
      size: fastn_dom.FontSize.Px(18),
      weight: 400
    }),
    mobile: fastn.recordInstance({
      font_family: ftd.font_copy,
      line_height: fastn_dom.FontSize.Px(24),
      size: fastn_dom.FontSize.Px(16),
      weight: 400
    })
  }),
  copy_large: fastn.recordInstance({
    desktop: fastn.recordInstance({
      font_family: ftd.font_copy,
      line_height: fastn_dom.FontSize.Px(34),
      size: fastn_dom.FontSize.Px(22),
      weight: 400
    }),
    mobile: fastn.recordInstance({
      font_family: ftd.font_copy,
      line_height: fastn_dom.FontSize.Px(28),
      size: fastn_dom.FontSize.Px(18),
      weight: 400
    })
  }),
  fine_print: fastn.recordInstance({
    desktop: fastn.recordInstance({
      font_family: ftd.font_code,
      line_height: fastn_dom.FontSize.Px(16),
      size: fastn_dom.FontSize.Px(12),
      weight: 400
    }),
    mobile: fastn.recordInstance({
      font_family: ftd.font_code,
      line_height: fastn_dom.FontSize.Px(16),
      size: fastn_dom.FontSize.Px(12),
      weight: 400
    })
  }),
  blockquote: fastn.recordInstance({
    desktop: fastn.recordInstance({
      font_family: ftd.font_code,
      line_height: fastn_dom.FontSize.Px(21),
      size: fastn_dom.FontSize.Px(16),
      weight: 400
    }),
    mobile: fastn.recordInstance({
      font_family: ftd.font_code,
      line_height: fastn_dom.FontSize.Px(21),
      size: fastn_dom.FontSize.Px(16),
      weight: 400
    })
  }),
  source_code: fastn.recordInstance({
    desktop: fastn.recordInstance({
      font_family: ftd.font_code,
      line_height: fastn_dom.FontSize.Px(30),
      size: fastn_dom.FontSize.Px(18),
      weight: 400
    }),
    mobile: fastn.recordInstance({
      font_family: ftd.font_code,
      line_height: fastn_dom.FontSize.Px(21),
      size: fastn_dom.FontSize.Px(16),
      weight: 400
    })
  }),
  button_small: fastn.recordInstance({
    desktop: fastn.recordInstance({
      font_family: ftd.font_display,
      line_height: fastn_dom.FontSize.Px(19),
      size: fastn_dom.FontSize.Px(14),
      weight: 400
    }),
    mobile: fastn.recordInstance({
      font_family: ftd.font_display,
      line_height: fastn_dom.FontSize.Px(19),
      size: fastn_dom.FontSize.Px(14),
      weight: 400
    })
  }),
  button_medium: fastn.recordInstance({
    desktop: fastn.recordInstance({
      font_family: ftd.font_display,
      line_height: fastn_dom.FontSize.Px(21),
      size: fastn_dom.FontSize.Px(16),
      weight: 400
    }),
    mobile: fastn.recordInstance({
      font_family: ftd.font_display,
      line_height: fastn_dom.FontSize.Px(21),
      size: fastn_dom.FontSize.Px(16),
      weight: 400
    })
  }),
  button_large: fastn.recordInstance({
    desktop: fastn.recordInstance({
      font_family: ftd.font_display,
      line_height: fastn_dom.FontSize.Px(24),
      size: fastn_dom.FontSize.Px(18),
      weight: 400
    }),
    mobile: fastn.recordInstance({
      font_family: ftd.font_display,
      line_height: fastn_dom.FontSize.Px(24),
      size: fastn_dom.FontSize.Px(18),
      weight: 400
    })
  }),
  link: fastn.recordInstance({
    desktop: fastn.recordInstance({
      font_family: ftd.font_display,
      line_height: fastn_dom.FontSize.Px(19),
      size: fastn_dom.FontSize.Px(14),
      weight: 400
    }),
    mobile: fastn.recordInstance({
      font_family: ftd.font_display,
      line_height: fastn_dom.FontSize.Px(19),
      size: fastn_dom.FontSize.Px(14),
      weight: 400
    })
  }),
  label_large: fastn.recordInstance({
    desktop: fastn.recordInstance({
      font_family: ftd.font_display,
      line_height: fastn_dom.FontSize.Px(19),
      size: fastn_dom.FontSize.Px(14),
      weight: 400
    }),
    mobile: fastn.recordInstance({
      font_family: ftd.font_display,
      line_height: fastn_dom.FontSize.Px(19),
      size: fastn_dom.FontSize.Px(14),
      weight: 400
    })
  }),
  label_small: fastn.recordInstance({
    desktop: fastn.recordInstance({
      font_family: ftd.font_display,
      line_height: fastn_dom.FontSize.Px(16),
      size: fastn_dom.FontSize.Px(12),
      weight: 400
    }),
    mobile: fastn.recordInstance({
      font_family: ftd.font_display,
      line_height: fastn_dom.FontSize.Px(16),
      size: fastn_dom.FontSize.Px(12),
      weight: 400
    })
  })
});
ftd.default_colors = fastn.recordInstance({
  background: fastn.recordInstance({
    base: fastn.recordInstance({
      dark: "#18181b",
      light: "#e7e7e4"
    }),
    code: fastn.recordInstance({
      dark: "#21222C",
      light: "#F5F5F5"
    }),
    overlay: fastn.recordInstance({
      dark: "rgba(0, 0, 0, 0.8)",
      light: "rgba(0, 0, 0, 0.8)"
    }),
    step_1: fastn.recordInstance({
      dark: "#141414",
      light: "#f3f3f3"
    }),
    step_2: fastn.recordInstance({
      dark: "#585656",
      light: "#c9cece"
    })
  }),
  border: fastn.recordInstance({
    dark: "#434547",
    light: "#434547"
  }),
  border_strong: fastn.recordInstance({
    dark: "#919192",
    light: "#919192"
  }),
  text: fastn.recordInstance({
    dark: "#a8a29e",
    light: "#584b42"
  }),
  text_strong: fastn.recordInstance({
    dark: "#ffffff",
    light: "#141414"
  }),
  shadow: fastn.recordInstance({
    dark: "#007f9b",
    light: "#007f9b"
  }),
  scrim: fastn.recordInstance({
    dark: "#007f9b",
    light: "#007f9b"
  }),
  cta_primary: fastn.recordInstance({
    base: fastn.recordInstance({
      dark: "#2dd4bf",
      light: "#2dd4bf"
    }),
    border: fastn.recordInstance({
      dark: "#2b8074",
      light: "#2b8074"
    }),
    border_disabled: fastn.recordInstance({
      dark: "#65b693",
      light: "#65b693"
    }),
    disabled: fastn.recordInstance({
      dark: "rgba(44, 201, 181, 0.1)",
      light: "rgba(44, 201, 181, 0.1)"
    }),
    focused: fastn.recordInstance({
      dark: "#2cbfac",
      light: "#2cbfac"
    }),
    hover: fastn.recordInstance({
      dark: "#2c9f90",
      light: "#2c9f90"
    }),
    pressed: fastn.recordInstance({
      dark: "#2cc9b5",
      light: "#2cc9b5"
    }),
    text: fastn.recordInstance({
      dark: "#feffff",
      light: "#feffff"
    }),
    text_disabled: fastn.recordInstance({
      dark: "#65b693",
      light: "#65b693"
    })
  }),
  cta_secondary: fastn.recordInstance({
    base: fastn.recordInstance({
      dark: "#4fb2df",
      light: "#4fb2df"
    }),
    border: fastn.recordInstance({
      dark: "#209fdb",
      light: "#209fdb"
    }),
    border_disabled: fastn.recordInstance({
      dark: "#65b693",
      light: "#65b693"
    }),
    disabled: fastn.recordInstance({
      dark: "rgba(79, 178, 223, 0.1)",
      light: "rgba(79, 178, 223, 0.1)"
    }),
    focused: fastn.recordInstance({
      dark: "#4fb1df",
      light: "#4fb1df"
    }),
    hover: fastn.recordInstance({
      dark: "#40afe1",
      light: "#40afe1"
    }),
    pressed: fastn.recordInstance({
      dark: "#4fb2df",
      light: "#4fb2df"
    }),
    text: fastn.recordInstance({
      dark: "#ffffff",
      light: "#584b42"
    }),
    text_disabled: fastn.recordInstance({
      dark: "#65b693",
      light: "#65b693"
    })
  }),
  cta_tertiary: fastn.recordInstance({
    base: fastn.recordInstance({
      dark: "#556375",
      light: "#556375"
    }),
    border: fastn.recordInstance({
      dark: "#e2e4e7",
      light: "#e2e4e7"
    }),
    border_disabled: fastn.recordInstance({
      dark: "#65b693",
      light: "#65b693"
    }),
    disabled: fastn.recordInstance({
      dark: "rgba(85, 99, 117, 0.1)",
      light: "rgba(85, 99, 117, 0.1)"
    }),
    focused: fastn.recordInstance({
      dark: "#e0e2e6",
      light: "#e0e2e6"
    }),
    hover: fastn.recordInstance({
      dark: "#c7cbd1",
      light: "#c7cbd1"
    }),
    pressed: fastn.recordInstance({
      dark: "#3b4047",
      light: "#3b4047"
    }),
    text: fastn.recordInstance({
      dark: "#ffffff",
      light: "#ffffff"
    }),
    text_disabled: fastn.recordInstance({
      dark: "#65b693",
      light: "#65b693"
    })
  }),
  cta_danger: fastn.recordInstance({
    base: fastn.recordInstance({
      dark: "#1C1B1F",
      light: "#1C1B1F"
    }),
    border: fastn.recordInstance({
      dark: "#1C1B1F",
      light: "#1C1B1F"
    }),
    border_disabled: fastn.recordInstance({
      dark: "#feffff",
      light: "#feffff"
    }),
    disabled: fastn.recordInstance({
      dark: "#1C1B1F",
      light: "#1C1B1F"
    }),
    focused: fastn.recordInstance({
      dark: "#1C1B1F",
      light: "#1C1B1F"
    }),
    hover: fastn.recordInstance({
      dark: "#1C1B1F",
      light: "#1C1B1F"
    }),
    pressed: fastn.recordInstance({
      dark: "#1C1B1F",
      light: "#1C1B1F"
    }),
    text: fastn.recordInstance({
      dark: "#1C1B1F",
      light: "#1C1B1F"
    }),
    text_disabled: fastn.recordInstance({
      dark: "#feffff",
      light: "#feffff"
    })
  }),
  accent: fastn.recordInstance({
    primary: fastn.recordInstance({
      dark: "#2dd4bf",
      light: "#2dd4bf"
    }),
    secondary: fastn.recordInstance({
      dark: "#4fb2df",
      light: "#4fb2df"
    }),
    tertiary: fastn.recordInstance({
      dark: "#c5cbd7",
      light: "#c5cbd7"
    })
  }),
  error: fastn.recordInstance({
    base: fastn.recordInstance({
      dark: "#311b1f",
      light: "#f5bdbb"
    }),
    border: fastn.recordInstance({
      dark: "#df2b2b",
      light: "#df2b2b"
    }),
    text: fastn.recordInstance({
      dark: "#c62a21",
      light: "#c62a21"
    })
  }),
  success: fastn.recordInstance({
    base: fastn.recordInstance({
      dark: "#405508ad",
      light: "#e3f0c4"
    }),
    border: fastn.recordInstance({
      dark: "#3d741f",
      light: "#3d741f"
    }),
    text: fastn.recordInstance({
      dark: "#479f16",
      light: "#467b28"
    })
  }),
  info: fastn.recordInstance({
    base: fastn.recordInstance({
      dark: "#15223a",
      light: "#c4edfd"
    }),
    border: fastn.recordInstance({
      dark: "#205694",
      light: "#205694"
    }),
    text: fastn.recordInstance({
      dark: "#1f6feb",
      light: "#205694"
    })
  }),
  warning: fastn.recordInstance({
    base: fastn.recordInstance({
      dark: "#544607a3",
      light: "#fbefba"
    }),
    border: fastn.recordInstance({
      dark: "#966220",
      light: "#966220"
    }),
    text: fastn.recordInstance({
      dark: "#d07f19",
      light: "#966220"
    })
  }),
  custom: fastn.recordInstance({
    eight: fastn.recordInstance({
      dark: "#d554b3",
      light: "#d554b3"
    }),
    five: fastn.recordInstance({
      dark: "#eb57be",
      light: "#eb57be"
    }),
    four: fastn.recordInstance({
      dark: "#7a65c7",
      light: "#7a65c7"
    }),
    nine: fastn.recordInstance({
      dark: "#ec8943",
      light: "#ec8943"
    }),
    one: fastn.recordInstance({
      dark: "#ed753a",
      light: "#ed753a"
    }),
    seven: fastn.recordInstance({
      dark: "#7564be",
      light: "#7564be"
    }),
    six: fastn.recordInstance({
      dark: "#ef8dd6",
      light: "#ef8dd6"
    }),
    ten: fastn.recordInstance({
      dark: "#da7a4a",
      light: "#da7a4a"
    }),
    three: fastn.recordInstance({
      dark: "#8fdcf8",
      light: "#8fdcf8"
    }),
    two: fastn.recordInstance({
      dark: "#f3db5f",
      light: "#f3db5f"
    })
  })
});
ftd.breakpoint_width = fastn.recordInstance({
  mobile: 768
});
ftd.device = fastn.mutable(fastn_dom.DeviceData.Desktop);
let inherited = fastn.recordInstance({
  colors: ftd.default_colors.getClone().setAndReturn("is_root", true),
  types: ftd.default_types.getClone().setAndReturn("is_root", true)
});
