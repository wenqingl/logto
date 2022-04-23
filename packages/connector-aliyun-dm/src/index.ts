import path from 'path';

import {
  ConnectorError,
  ConnectorErrorCodes,
  ConnectorMetadata,
  EmailSendMessageFunction,
  SendEmailResponse,
  ValidateConfig,
  EmailConnector,
  GetConnectorConfig,
} from '@logto/connector-types';
import { getMarkdownContents } from '@logto/connector-utils';
import { ConnectorType } from '@logto/schemas';
import { assert } from '@silverhand/essentials';
import { z } from 'zod';

import { singleSendMail } from './single-send-mail';

// eslint-disable-next-line unicorn/prefer-module
const currentPath = __dirname;
const pathToReadmeFile = path.join(currentPath, 'README.md');
const pathToConfigTemplate = path.join(currentPath, 'config-template.md');
const readmeContentFallback = 'Please check README.md file directory.';
const configTemplateFallback = 'Please check config-template.md file directory.';

/**
 * UsageType here is used to specify the use case of the template, can be either
 * 'Register', 'SignIn', 'ForgotPassword' or 'Test'.
 */
const templateGuard = z.object({
  usageType: z.string(),
  subject: z.string(),
  content: z.string(), // With variable {{code}}, support HTML
});

const configGuard = z.object({
  accessKeyId: z.string(),
  accessKeySecret: z.string(),
  accountName: z.string(),
  fromAlias: z.string().optional(),
  templates: z.array(templateGuard),
});

export type AliyunDmConfig = z.infer<typeof configGuard>;

export class AliyunDmConnector implements EmailConnector {
  public metadata: ConnectorMetadata = {
    id: 'aliyun-dm',
    type: ConnectorType.Email,
    name: {
      en: 'Aliyun Direct Mail',
      'zh-CN': '阿里云邮件推送',
    },
    // TODO: add the real logo URL (LOG-1823)
    logo: './logo.png',
    description: {
      en: 'A simple and efficient email service to help you send transactional notifications and batch email.',
      'zh-CN':
        '邮件推送（DirectMail）是款简单高效的电子邮件群发服务，构建在阿里云基础之上，帮您快速、精准地实现事务邮件、通知邮件和批量邮件的发送。',
    },
    readme: getMarkdownContents(pathToReadmeFile, readmeContentFallback),
    configTemplate: getMarkdownContents(pathToConfigTemplate, configTemplateFallback),
  };

  public readonly getConfig: GetConnectorConfig<AliyunDmConfig>;

  constructor(getConnectorConfig: GetConnectorConfig<AliyunDmConfig>) {
    this.getConfig = getConnectorConfig;
  }

  public validateConfig: ValidateConfig = async (config: unknown) => {
    const result = configGuard.safeParse(config);

    if (!result.success) {
      throw new ConnectorError(ConnectorErrorCodes.InvalidConfig, result.error.message);
    }
  };

  public sendMessage: EmailSendMessageFunction<SendEmailResponse> = async (address, type, data) => {
    const config = await this.getConfig(this.metadata.id);
    await this.validateConfig(config);
    const { accessKeyId, accessKeySecret, accountName, fromAlias, templates } = config;
    const template = templates.find((template) => template.usageType === type);

    assert(
      template,
      new ConnectorError(
        ConnectorErrorCodes.TemplateNotFound,
        `Cannot find template for type: ${type}`
      )
    );

    return singleSendMail(
      {
        AccessKeyId: accessKeyId,
        AccountName: accountName,
        ReplyToAddress: 'false',
        AddressType: '1',
        ToAddress: address,
        FromAlias: fromAlias,
        Subject: template.subject,
        HtmlBody:
          typeof data.code === 'string'
            ? template.content.replace(/{{code}}/g, data.code)
            : template.content,
      },
      accessKeySecret
    );
  };
}