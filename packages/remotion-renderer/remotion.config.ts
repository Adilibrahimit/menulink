import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// H.264 MP4, small file: the steam loop is gentle so a modest bitrate is plenty.
Config.setCodec("h264");
