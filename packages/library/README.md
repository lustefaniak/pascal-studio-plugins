# @lustefaniak/pascal-studio-library

Pascal editor plugin `studio:library`: a Library panel listing the project's own GLB models, served
by the studio worker ([contract](../core#the-worker)). Dimensions are read from the file, a usage
count shows how often a model stands in the scene, and the list follows the worker's watch, so a
model regenerated on disk appears without a refresh. Models are placed as ordinary `item` nodes.

Part of the [Pascal Studio plugins](../../README.md).
