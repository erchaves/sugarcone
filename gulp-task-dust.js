const concat = require('gulp-concat');
const gulp = require('gulp');
const dust = require('gulp-dust');
const tap = require('gulp-tap');
const path = require('path');
const streamSeries = require('stream-series');

const fileExtRegex = /\.[^/.]+$/;
// todo: use same as back-end?
const pathDust = 'node_modules/dustjs-linkedin/dist/dust-core.min.js';

module.exports = function(options) {
  const pathViews = options.pathViews;
  const pathDist = options.pathDist;
  const dustBuildFileName = options.dustBuildFileName || 'dust-build';
  const isDebug = options.isDebug;

  const getDustGlob = function(pathRoot) {
    return path.join(pathRoot, '/**/*.html');
  };

  const paths = {
    dust: pathDust,
    dustSetup: path.join(__dirname, 'dust-setup.js'),
    partials: path.join(pathViews, options.pathRelPartials),
    pageModules: options.pathPageModules,
    views: pathViews,
    dist: pathDist,
    sugarconeDist: path.join(pathDist, 'sugarcone'),
  };

  const globs = {
    views: getDustGlob(paths.views),
    partials: getDustGlob(paths.partials),
    pageModules: `${paths.pageModules}/*.js`,
  };

  const configFileContents = `{"isDebug": ${isDebug}}`;

  const getDustExpressHeader = function() {
    return `const _config = {"isDebug": ${isDebug}, "dustSetupPath": '${paths.dustSetup}', }`;
  };

  // Read the pages directory and create a dictionary of pageModules.
  var taskPageModules = function () {
    return gulp.src(globs.pageModules)
      .pipe(tap(function(file) {
        var fileName = path.basename(file.path, '.js');
        const pageModuleExportString = `export {default as ${fileName}} from '${paths.pageModules}/${fileName}';`;

        file.contents = Buffer.concat([
          new Buffer(pageModuleExportString),
        ]);
      }))
      .pipe(concat('page-module-index.js'))
      .pipe(gulp.dest(paths.sugarconeDist));
  };

  var getDustPartials = function () {
    return gulp.src(globs.partials)
      .pipe(dust({
        name: file => {
          // get the path relative to the views folder root
          var relPath = path.relative(paths.views, file.path);
          // strip ext
          var dustTemplateKey = relPath.replace(fileExtRegex, '');

          // this is now the key that dust will use to cache the template
          return dustTemplateKey;
        },
      }));
  };

  var taskDustBuild = function () {
    var dustSetup = gulp.src(paths.dustSetup);
    var dustSrc = gulp.src(paths.dust);
    var dustPartials = getDustPartials();

    return streamSeries(dustSrc, dustSetup, dustPartials)
      .pipe(concat(`${dustBuildFileName}.js`))
      .pipe(gulp.dest(paths.sugarconeDist));
  };

  var taskDustExpress = function () {
    var header = getDustExpressHeader(paths.dist);

    return gulp.src(path.join(__dirname, 'dust-express.js'))
      .pipe(tap(function(file, t) {
          file.contents = Buffer.concat([
            new Buffer(header),
            file.contents
        ]);
      }))
      .pipe(concat('dust-express.js'))
      .pipe(gulp.dest(paths.sugarconeDist));
  };

  var taskHtml = function () {
    var process = gulp.src(globs.views)
      .pipe(dust({
        config: {
            // the dust whitespace parser is broken https://github.com/linkedin/dustjs/issues/238
          whitespace: true,
        },
      }))
      // todo: make this explicit #dustDistViews
      .pipe(gulp.dest(path.join(paths.dist, 'views')));

      return process;
  };

  return {
    taskPageModules: taskPageModules,
    taskDustBuild: taskDustBuild,
    taskDustExpress: taskDustExpress,
    taskHtml: taskHtml,
    globs: globs,
  };
};
