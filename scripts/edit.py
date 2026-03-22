from moviepy import VideoFileClip, concatenate_videoclips
import json

def auto_edit(video_path, plan_path, output_path):
    with open(plan_path, "r") as f:
        plan = json.load(f)
    segments = plan["segments"]
    print("开始剪辑，共 " + str(len(segments)) + " 个片段...")
    video = VideoFileClip(video_path)
    clips = []
    for i, seg in enumerate(segments):
        start = seg["start"]
        end = min(seg["end"], video.duration)
        reason = seg["reason"]
        clip = video.subclipped(start, end)
        clips.append(clip)
        print("  片段" + str(i+1) + ": " + str(start) + "s -> " + str(end) + "s | " + reason)
    final = concatenate_videoclips(clips, method="compose")
    final.write_videofile(output_path, codec="libx264", audio_codec="aac", fps=24, threads=4)
    video.close()
    print("完成：" + output_path)
