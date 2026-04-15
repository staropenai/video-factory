# JTG 项目经验积累系统 V2
**副标题：** 自动审计驱动的学习闭环  
**版本：** V2.0  
**更新：** 2026-04-15

---

## 设计起点：一个伪代码

李笑来《自学是门手艺》（github.com/selfteaching）的核心伪代码：

```python
def teach_yourself(anything):
    while not create():
        learn()
        practice()
    return teach_yourself(another)
```

| 伪代码 | 工程含义 | 本系统实现 |
|---|---|---|
| `while not create()` | 没有产出就继续循环 | 没有完成信号不算完成 |
| `learn(); practice()` | 学了要练，练了才能创造 | 知识必须转化为规则/脚本才有价值 |
| `return teach_yourself(another)` | 每轮结束后启动下一轮 | 每次迭代产出下一轮任务种子 |

**V1 的问题：** 把「经验积累」当作事后善意行为，依赖执行者自觉。
**V2 的修正：** 把「积累」内嵌进任务完成条件，不积累 = 未完成。

---

## 核心原则（三条）

**原则 1：完整比快速更重要**
李笑来：「小，无所谓；完整，才是关键。」
一个完整闭环的小任务 > 一个没有验收和记录的大任务。

**原则 2：积累必须可复用**
经验如果不能被下一轮任务直接调用，只是存档，不是积累。

**原则 3：失败是资产，不是损失**
失败记录（pitfall）是最有价值的知识资产，必须强制生成，不依赖自觉。

---

## 学习循环：EOVALU

```
E → Evidence    先确认现状与证据
O → Operate     在规则边界内执行
V → Verify      用脚本/路由/测试确认结果
A → Audit       审计输出结构化问题
L → Learn       把可复用结论写入知识资产
U → Upgrade     必要时升级规则、基线或下一轮任务
```

比 BML 多了 Evidence 和 Audit 两步。没有这两步，循环是假循环。

---

## 五类知识资产

### 资产 1：约束资产
**文件：** `docs/constraints.dsl.yml`（机器主读）
**升级规则：** 同一违规 ≥ 2 次 + 代价高 + 影响范围大 → 升为 IP

### 资产 2：决策资产
**文件：** `docs/decision_log.md`
**记录门槛（任一）：** 拒绝了合理备选 / 3 个月后可能被质疑 / 涉及架构选择
**回看机制：** 每 3 次迭代标记「✓ 正确」或「✗ 需修正」

### 资产 3：错误资产
**文件：** `docs/pitfall_registry.md`
**强制创建条件（任一）：**
```
□ 验证脚本失败
□ 任务被规则阻断
□ 生产 bug 被用户发现
□ 同一问题第二次出现
□ 任务耗时超预期 2 倍以上
```

### 资产 4：MNK 资产（模块最少必要知识）
**文件：** `audit/mnk_cards/<模块>.md`
**每张卡只包含：**
```
当前状态（一句话）/ 不能碰（IP/LR）/ 关键文件（≤5）
当前 P0（≤3 条）/ 危险点（上次踩的坑）
```

### 资产 5：基线资产
**文件：** `docs/baselines/latest.json`
**必须包含：** 时间、commit hash、测试数、TS 错误数、已上线 ZONE、已知坏路由

---

## 触发机制

| 时机 | 必须做 |
|---|---|
| 迭代开始前 | 跑证据门 + 读 MNK + 加载基线 |
| 任务成功后 | 刷新 latest.json + 更新 MNK |
| 任务失败后 | 写 pitfall + 保存失败快照 |
| 做了重要决策 | 写 decision_log |
| 同一问题第二次出现 | 升级为约束 |
| 每 3 次迭代后 | 回顾 decision_log |

---

## 任务完成的四个门槛

```
□ 1. 证据门 OPEN
□ 2. 完成信号达成（脚本可验证）
□ 3. 审计无 P0
□ 4. 知识资产已更新
```

四个缺一，视为未完成。

---

## 文件系统结构

```
web/
├── docs/
│   ├── constraints.dsl.yml
│   ├── decision_log.md
│   ├── pitfall_registry.md
│   └── baselines/
│       ├── latest.json
│       └── 2026-04-15.json
├── audit/
│   ├── mnk_cards/
│   └── templates/
│       ├── task_packet.yml
│       ├── audit_output.yml
│       └── pitfall_record.yml
└── scripts/
    ├── evidence_gate.sh
    ├── verify_v5.sh
    └── audit_router.sh
```

---

## 最小上下文包（新窗口使用）

```
规则层：docs/constraints.dsl.yml
状态层：audit/mnk_cards/<模块>.md + docs/baselines/latest.json
任务层：task_packet（影响文件 + 完成信号 + 禁止项）
```

---

*版本：JTG-LEARNING-V2.0 · 2026-04-15*
