import { Button, Result, Space } from "antd";
import Link from "next/link";

// Rendered for any project, task or team the caller cannot see, whether it belongs to another
// company or sits outside their scope in this one. The response is identical on purpose.
export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <Result
        status="404"
        title="We couldn't find that"
        subTitle="It may have been removed, or it isn't part of your company or your projects. Anything you can work on is listed under Projects."
        extra={
          <Space>
            <Link href="/projects"><Button type="primary">Go to my projects</Button></Link>
            <Link href="/dashboard"><Button>Back to dashboard</Button></Link>
          </Space>
        }
      />
    </main>
  );
}
