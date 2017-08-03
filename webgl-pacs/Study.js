class Series {
  constructor(_w, _h, _d, _name, _images) {
    this.width = _w;
    this.height = _h;
    this.depth = _d;
    this.name = _name;
    this.images = _images;
  }
}

class Study {
  constructor(argmap) {
    if (argmap.get('type') == 'nifti') {
      initFromNiftis(argmap);
    }
  }

  initFromNiftis(argmap) {
    var nHeaders = argmap.get('headers'); // array of headers from the nifti files
    var nImages = argmap.get('imageData');// array of image data from the nifti files

    this.series = []; 

    var N = nHeaders.length;

    for (var i = 0; i < N; ++i) { // loop over nifti files
      var images = [];
      var header = nHeaders[i];
      var w = header.dims[1];
      var h = header.dims[2];
      var d = header.dims[3];
      for (var j = 0; j < d; j++) { // loop over image
        var sliceSize = w * h * (header.numBitsPerVoxel/8);
        images.push(new Int16Array(nImage.slice(j*sliceSize, (j+1)*sliceSize)));
      }
      this.series.push(new Series(w, h, d, header.description, images));
    }
  }

  to2DTextures() {
    var texArray = []
    for (let s of this.series) {
      var tex = [];
      for (let img of s.images) {
        var texData = twgl.primitives.createAugmentedTypedArray(4, s.width * s.height); // Default Float32 array
        if (img instanceof Uint16Array) {
          for (var i = 0; i < s.width * s.height; i++) {
            // convert signed short to float
            var fv = (img[i] + 32768.) / 65536.;
            texData.push([fv, fv, fv, 1.0]);
          }
        }
        tex.push(twgl.createTexture(gl, {
          min: gl.NEAREST,
          mag: gl.NEAREST,
          width: s.width,
          height: s.height,
          src: texData,
        }));
      }
      texArray.push(tex);
    }
    return texArray;
  }

}