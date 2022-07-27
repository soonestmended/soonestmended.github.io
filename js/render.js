(async () => {
    if (navigator.gpu === undefined) {
        alert("WebGPU is not supported/enabled in your browser");
        return;
    }

    // Get a GPU device to render with
    var adapter = await navigator.gpu.requestAdapter();
    var device = await adapter.requestDevice();

    // Get a context to display our rendered image on the canvas
    var canvas = document.getElementById("webgpu-canvas");
    var context = canvas.getContext("webgpu");

    // Setup shader modules
    // ....

    // Upload vertex data
    // ....

    // Setup render outputs
    // ....

    // Create render pipeline
    // ....

    // Render!
    // ....
})();
