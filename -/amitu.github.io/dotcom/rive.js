/*import "https://unpkg.com/@rive-app/canvas@1.0.102";


window.onload = (e) => {
    let old_node = document.getElementById("panda-image");
    let new_node  = stringToHTML("<canvas id=\"canvas\"></canvas>");
    old_node.parentNode.replaceChild(new_node.children[0], old_node);
    const r = new rive.Rive({
        // src: "https://cdn.rive.app/animations/vehicles.riv",
        src: "panda.riv",
        canvas: document.getElementById("canvas"),
        autoplay: true,
        stateMachines: "State Machine 1",
        onLoad: () => {
            r.resizeDrawingSurfaceToCanvas();
        },
    });
}*/
function onScriptLoad_js() {
    let le = document.querySelectorAll("#panda-image");
    let old_node = le[0];
    if (!!window.ftd.data.main && !!window.ftd.data.main["ftd#device"] && window.ftd.data.main["ftd#device"] == "mobile") {
        old_node = le[le.length - 1];
    }
    old_node.style.display = "none";
    let new_node  = stringToHTML("<canvas id=\"canvas\"></canvas>");
    old_node.parentNode.insertBefore(new_node.children[0], old_node);


    const r = new window.rive.Rive({
        src: "panda.riv",
        canvas: document.getElementById("canvas"),
        autoplay: true,
        stateMachines: "State Machine 1",
        onLoad: () => {
            r.resizeDrawingSurfaceToCanvas();
        },
    });
}


function animate_panda() {
    let le = document.querySelectorAll("#panda-image");
    let old_node = le[0];
    if (!!window.ftd.data.main && !!window.ftd.data.main["ftd#device"] && window.ftd.data.main["ftd#device"] == "mobile") {
        old_node = le[le.length - 1];
    }
    old_node.style.display = "none";
    let new_node  = stringToHTML("<canvas id=\"canvas\"></canvas>");
    old_node.parentNode.insertBefore(new_node.children[0], old_node);


    const r = new window.rive.Rive({
        src: "panda.riv",
        canvas: document.getElementById("canvas"),
        autoplay: true,
        stateMachines: "State Machine 1",
        onLoad: () => {
            r.resizeDrawingSurfaceToCanvas();
        },
    });
}


function stringToHTML(str) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(str, 'text/html');
    return doc.body;
}
