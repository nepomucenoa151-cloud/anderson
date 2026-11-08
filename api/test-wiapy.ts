import handler from './webhook.ts';

async function executeTestSuite() {
  console.log('=========================================================');
  console.log('   BATERIA DE TESTES: WEBHOOK WIAPY (DOCUMENTAÇÃO OFICIAL)');
  console.log('=========================================================\n');

  let totalTests = 0;
  let passedTests = 0;

  function runCheck(testName: string, condition: boolean, details: any = '') {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`[PASS] ${testName}`);
    } else {
      console.error(`[FAIL] ${testName} ->`, details);
    }
  }

  function mockRequest(body: any, headers: Record<string, string> = {}) {
    const req: any = {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body
    };
    let statusCode = 200;
    let responseData = '';
    const res: any = {
      setHeader: () => {},
      statusCode: 200,
      end: (data: string) => {
        responseData = data;
      }
    };
    return {
      execute: async () => {
        await handler(req, res);
        return { status: res.statusCode, body: JSON.parse(responseData) };
      }
    };
  }

  // 1. STATUS: "paid" com R$ 47,90 (4790 centavos)
  {
    const res = await mockRequest({
      payment: {
        id: '680bb49dcc58d1620569cb2e_4790',
        status: 'paid',
        amount: 4790,
        payment_method: 'pix',
        type: 'payment'
      },
      customer: {
        name: 'Carlos Eduardo Silva',
        email: 'carlos.silva@email.com',
        mobile_phone: '(11) 98765-4321',
        document: '123.456.789-00'
      },
      tracking: {
        ip: '187.55.120.30',
        useragent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        fbc: 'fb.1.1712345678.IwAR123',
        fbp: 'fb.1.1712345678.987654'
      },
      checkout: {
        title: 'Protocolo Glicose Zero - Pacote Completo'
      }
    }).execute();

    runCheck(
      "1.1 Status 'paid' (4790 centavos) converte para 47.90 reais e payment.id correto",
      res.status === 200 && res.body.value === 47.90 && res.body.paymentId === '680bb49dcc58d1620569cb2e_4790',
      res.body
    );
  }

  // 2. STATUS: "paid" com R$ 97,00 (9700 centavos)
  {
    const res = await mockRequest({
      payment: {
        id: '680bb49dcc58d1620569cb2e_9700',
        status: 'paid',
        amount: 9700,
        payment_method: 'credit_card',
        type: 'payment'
      },
      customer: {
        name: 'Fernanda Costa',
        email: 'fernanda@email.com',
        mobile_phone: '21999998888'
      },
      tracking: {
        ip: '201.88.90.12',
        useragent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    }).execute();

    runCheck(
      "1.2 Status 'paid' (9700 centavos) converte para 97.00 reais sem valor fixo",
      res.status === 200 && res.body.value === 97.00 && res.body.paymentId === '680bb49dcc58d1620569cb2e_9700',
      res.body
    );
  }

  // 3. STATUS: "unpaid" (aguardando pagamento PIX/Boleto)
  {
    const res = await mockRequest({
      payment: {
        id: '680bb49dcc58d1620569cb2e_unpaid',
        status: 'unpaid',
        amount: 4790,
        payment_method: 'pix'
      }
    }).execute();

    runCheck(
      "2. Status 'unpaid' e ignorado sem disparar Purchase",
      res.status === 200 && res.body.dispatched === false && res.body.action === 'unpaid_ignored',
      res.body
    );
  }

  // 4. STATUS: "credit_card_declined" (cartão recusado)
  {
    const res = await mockRequest({
      payment: {
        id: '680bb49dcc58d1620569cb2e_declined',
        status: 'credit_card_declined',
        amount: 4790,
        payment_method: 'credit_card'
      }
    }).execute();

    runCheck(
      "3. Status 'credit_card_declined' e ignorado sem disparar Purchase",
      res.status === 200 && res.body.dispatched === false && res.body.action === 'credit_card_declined_ignored',
      res.body
    );
  }

  // 5. STATUS: "refunded" (estorno/reembolso)
  {
    const res = await mockRequest({
      payment: {
        id: '680bb49dcc58d1620569cb2e_refunded',
        status: 'refunded',
        amount: 4790
      }
    }).execute();

    runCheck(
      "4. Status 'refunded' registra estorno sem novo Purchase",
      res.status === 200 && res.body.dispatched === false && res.body.action === 'refund_registered',
      res.body
    );
  }

  // 6. STATUS: "chargedback" (chargeback / contestação)
  {
    const res = await mockRequest({
      payment: {
        id: '680bb49dcc58d1620569cb2e_chargedback',
        status: 'chargedback',
        amount: 4790
      }
    }).execute();

    runCheck(
      "5. Status 'chargedback' registra chargeback sem novo Purchase",
      res.status === 200 && res.body.dispatched === false && res.body.action === 'chargeback_registered',
      res.body
    );
  }

  // 7. STATUS: payment null / ausente (carrinho abandonado)
  {
    const res = await mockRequest({
      payment: null,
      customer: {
        name: 'Lead Incompleto',
        email: 'lead@email.com',
        mobile_phone: '11988887777'
      },
      checkout: {
        id: '66e0799f17f298ff3c60f345',
        title: 'Protocolo Glicose Zero'
      }
    }).execute();

    runCheck(
      "6. 'payment: null' identifica carrinho abandonado sem disparar Purchase",
      res.status === 200 && res.body.dispatched === false && res.body.action === 'abandoned_cart_ignored',
      res.body
    );
  }

  // 8. DEDUPLICAÇÃO: Reenvio do mesmo payment.id
  {
    const res = await mockRequest({
      payment: {
        id: '680bb49dcc58d1620569cb2e_4790', // já processado no teste 1
        status: 'paid',
        amount: 4790
      }
    }).execute();

    runCheck(
      '7. Deduplicacao persistente bloqueia reenvio do mesmo payment.id',
      res.status === 200 && res.body.dispatched === false && res.body.reason.includes('Deduplicação persistente ativa'),
      res.body
    );
  }

  // 9. AUTENTICAÇÃO: Validação do cabeçalho Authorization
  {
    process.env.WIAPY_WEBHOOK_SECRET = 'segredo_wiapy_oficial_2026';

    // Teste com token errado
    const resErrado = await mockRequest(
      { payment: { id: 'pay_auth_test', status: 'paid', amount: 4790 } },
      { authorization: 'Bearer token_falso' }
    ).execute();

    runCheck(
      '8.1 Rejeita Authorization com token invalido (HTTP 401)',
      resErrado.status === 401 && resErrado.body.error === 'Não autorizado.',
      resErrado.body
    );

    // Teste com token correto
    const resCorreto = await mockRequest(
      { payment: { id: 'pay_auth_test', status: 'paid', amount: 4790 } },
      { authorization: 'Bearer segredo_wiapy_oficial_2026' }
    ).execute();

    runCheck(
      '8.2 Aceita Authorization com token correto (HTTP 200)',
      resCorreto.status === 200 && resCorreto.body.paymentId === 'pay_auth_test',
      resCorreto.body
    );

    delete process.env.WIAPY_WEBHOOK_SECRET;
  }

  console.log(`\n=========================================================`);
  console.log(` RESULTADO FINAL: ${passedTests}/${totalTests} TESTES APROVADOS`);
  console.log(`=========================================================`);
}

executeTestSuite().catch(console.error);
