import os
import json
from dotenv import load_dotenv
from scripts.analyze import analyze_srt
from scripts.edit import auto_edit

load_dotenv()

print("=" * 40)
print("🏭 AI视频工厂 — 开始运行")
print("=" * 40)

print("\n📊 阶段1：Claude分析字幕...")
plan = analyze_srt("input/video.srt")
with open("edit_plan.json", "w", encoding="utf-8") as f:
    json.dump(plan, f, ensure_ascii=False, indent=2)

print("\n✂️  阶段2：MoviePy自动剪辑...")
auto_edit(
    video_path="input/video.avi",
    plan_path="edit_plan.json",
    output_path="output/final.mp4"
)

print("\n🎉 完成！查看 output/final.mp4")
