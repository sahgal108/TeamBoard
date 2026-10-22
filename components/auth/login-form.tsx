"use client";

import { LockOutlined, MailOutlined } from "@ant-design/icons";
import { Alert, Avatar, Button, Divider, Flex, Form, Input, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DEMO_PASSWORD, type DemoAccount } from "@/lib/auth/demo-accounts";
import { avatarSize, font, space, textStyle } from "@/lib/design-system";

type Props = { demoAccounts: DemoAccount[]; next: string };
type Values = { email: string; password: string };

export function LoginForm({ demoAccounts, next }: Props) {
  const router = useRouter();
  const [form] = Form.useForm<Values>();
  const email = Form.useWatch("email", form);
  const password = Form.useWatch("password", form);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(values: Values) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? "Sign in failed. Try again.");
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  function fillDemo(account: DemoAccount) {
    form.setFieldsValue({ email: account.email, password: DEMO_PASSWORD });
    setError(null);
  }

  return (
    <Flex vertical gap={space[2]}>
      <Form form={form} layout="vertical" requiredMark={false} size="large" onFinish={submit} onValuesChange={() => setError(null)}>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: "email", message: "Enter your work email" }]}>
          <Input prefix={<MailOutlined />} autoComplete="username" />
        </Form.Item>
        <Form.Item name="password" label="Password" rules={[{ required: true, message: "Enter your password" }]}>
          <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
        </Form.Item>
        {error && <Alert type="error" showIcon title={error} style={{ marginBottom: space[4] }} />}
        <Button type="primary" htmlType="submit" block loading={pending} disabled={!email || !password}>
          Sign in
        </Button>
      </Form>

      {demoAccounts.length > 0 && (
        <>
          <Divider titlePlacement="start" plain>
            <Typography.Text type="secondary" style={textStyle.caption}>Demo accounts · click to fill</Typography.Text>
          </Divider>
          <Flex wrap gap={space[2]}>
            {demoAccounts.map(a => (
              <Button
                key={a.email}
                shape="round"
                onClick={() => fillDemo(a)}
                type={email === a.email ? "primary" : "default"}
                ghost={email === a.email}
                style={a.company === "Acme Technologies" ? undefined : { borderStyle: "dashed" }}
                icon={<Avatar size={avatarSize.sm} style={{ background: a.color, fontSize: font.size.xs, fontWeight: font.weight.semibold }}>{a.initials}</Avatar>}
              >
                {a.name}
                <Typography.Text type="secondary" style={textStyle.caption}>
                  {a.role}
                  {a.company !== "Acme Technologies" ? ` · ${a.company}` : ""}
                </Typography.Text>
              </Button>
            ))}
          </Flex>
          <Typography.Text type="secondary" style={textStyle.caption}>
            Password for every demo account: <Typography.Text code>{DEMO_PASSWORD}</Typography.Text>
          </Typography.Text>
        </>
      )}
    </Flex>
  );
}
