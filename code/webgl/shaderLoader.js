var vertexShaders       = $('script[type="x-shader/x-vertex"]');
var fragmentShaders     = $('script[type="x-shader/x-fragment"]');
var shadersLoaderCount  = vertexShaders.length + fragmentShaders.length;

var shadersHolder = { vertex: '', fragment: '' };

function loadShader(shader, type) {
    var $shader = $(shader);

    $.ajax({
        url: $shader.data('src'),
        dataType: 'text',
        context: {
            name: $shader.data('name'),
            type: type
        },
        complete: processShader
    });
}

function processShader( jqXHR, textStatus ) {
    shadersLoaderCount--;
    shadersHolder[this.type] = jqXHR.responseText;

    if ( !shadersLoaderCount ) {
        shadersLoadComplete();
    }
}

function shadersLoadComplete() {
    init();
}
// Use a for loop if there is more than one
loadShader( vertexShaders[0], 'vertex' );
loadShader( fragmentShaders[0], 'fragment' );