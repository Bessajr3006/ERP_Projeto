import 'dotenv/config';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import mysql, { ConnectionOptions, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '../config/db';
import { CANONICAL_SCHEMA_SQL } from './canonicalSchema';
import { runMigration18 } from './run_migration_18';
import { runMigration19 } from './run_migration_19';
import { runMigration21 } from './run_migration_21';
import { runMigration202AddSolidconBankIdToBankAccounts } from './run_migration_202_add_solidcon_bank_id_to_bank_accounts';
import { runMigration203CardStatements } from './run_migration_203_card_statements';
import { runMigration204ReportRafaelPermissions } from './run_migration_204_report_rafael_permissions';
import { runMigration205AddSolidconRole } from './run_migration_205_add_solidcon_role';
import { runMigration206ActivityGroups } from './run_migration_206_activity_groups';
import { runMigration207CustomerActivities } from './run_migration_207_customer_activities';
import { runMigration208ActivityGroupsMonthlyFee } from './run_migration_208_activity_groups_monthly_fee';
import { runMigration209ActivityGroupsOperationCost } from './run_migration_209_activity_groups_operation_cost';
import { runMigration210AddAuxiliarContadorRole } from './run_migration_210_add_auxiliar_contador_role';
import { runMigration211CopyDbCredentials } from './run_migration_211_copy_db_credentials';
import { runMigration212MigrateUiPreferences } from './run_migration_212_migrate_ui_preferences';
import { runMigration213CreateCostCentersTable } from './run_migration_213_create_cost_centers_table';
import { runMigration214AddAlterdataFields } from './run_migration_214_add_alterdata_fields';
import { runMigration215AddOnlyPixToCustomers } from './run_migration_215_add_only_pix_to_customers';
import { runMigration216AddCdempresaAlterdata } from './run_migration_216_add_cdempresa_alterdata';
import { runMigration222TransactionsWhatsappSentInt } from './run_migration_222_transactions_whatsapp_sent_int';
import { runMigration223AddFineInterestToTransactions } from './run_migration_223_add_fine_interest_to_transactions';
import { runMigration224BankAccountsPixSettings } from './run_migration_224_bank_accounts_pix_settings';
import { runMigration225AddReceivedChannelToTransactions } from './run_migration_225_add_received_channel_to_transactions';
import { runMigration226RemoveKeystoneInterestTransactions } from './run_migration_226_remove_keystone_interest_transactions';
import { runMigration227ExpandDeclarationTypesTaxRegime } from './run_migration_227_expand_declaration_types_tax_regime';
import { runMigration228AddSolidconInterestKeyToTransactions } from './run_migration_228_add_solidcon_interest_key_to_transactions';
import { runMigration229UpdateSolidconInterestKeyToConta } from './run_migration_229_update_solidcon_interest_key_to_conta';
import { runMigration230SyncAllSolidconInterestRevenues } from './run_migration_230_sync_all_solidcon_interest_revenues';
import { runMigration231ReportPedidosDorsalPermissions } from './run_migration_231_report_pedidos_dorsal_permissions';
import { runMigration232ReportSaldoBancoPermissions } from './run_migration_232_report_saldo_banco_permissions';
import { runMigration233AddOnlySolidconBaixaToCustomers } from './run_migration_233_add_only_solidcon_baixa_to_customers';
import { runMigration234AddExemptInterestFineToCustomers } from './run_migration_234_add_exempt_interest_fine_to_customers';
import { runMigration235AddAsaasFieldsToBankAccounts } from './run_migration_235_add_asaas_fields_to_bank_accounts';
import { runMigration236CleanEsgN1Transactions } from './run_migration_236_clean_esg_n1_transactions';
import { runMigration237RevenueWhatsappAudits } from './run_migration_237_revenue_whatsapp_audits';
import { runMigration238BackfillWhatsappAudits } from './run_migration_238_backfill_whatsapp_audits';
import { runMigration240SyncSolidconInterestAndFines } from './run_migration_240_sync_solidcon_interest_and_fines';
import { runMigration241FixReceivedAmountWithFines } from './run_migration_241_fix_received_amount_with_fines';
import { runMigration242CompanySolidconConfigs } from './run_migration_242_company_solidcon_configs';
import { runMigration243CustomerHideInRevenuesGrid } from './run_migration_243_customer_hide_in_revenues_grid';
import { runMigration244ChangeDateLaunchToDatetime } from './run_migration_244_change_date_launch_to_datetime';
import { runMigration245FixCorruptedFinesAndInterestKeys } from './run_migration_245_fix_corrupted_fines_and_interest_keys';
import { runMigration246CompanyDorsalConfigs } from './run_migration_246_company_dorsal_configs';
import { runMigration247CompanyWhatsappAllowAllUsersActiveSender } from './run_migration_247_company_whatsapp_allow_all_users_active_sender';
import runMigration248FinSolidconVisionPermissions from './run_migration_248_fin_solidcon_vision_permissions';
import { runMigration249CompanyAlterdataConfigs } from './run_migration_249_company_alterdata_configs';
import { runMigration250AccountingClosings } from './run_migration_250_accounting_closings';
import { runMigration251UserDefaultDeclarationSigner } from './run_migration_251_user_default_declaration_signer';
import runMigration252SocioModulePermissions from './run_migration_252_socio_module_permissions';
import runMigration253CreateErpAppUser from './run_migration_253_create_erp_app_user';
import { runMigration254EncryptCredentialsAndDropRawPassword } from './run_migration_254_encrypt_credentials_and_drop_raw_password';
import { runMigration22 } from './run_migration_22';
import { runMigration23 } from './run_migration_23';
import { runMigration24 } from './run_migration_24';
import { runMigration25 } from './run_migration_25';
import { runMigration26 } from './run_migration_26';
import { runMigration27 } from './run_migration_27';
import { runMigration28 } from './run_migration_28';
import { runMigration29 } from './run_migration_29';
import { runMigration30 } from './run_migration_30';
import { runMigration31 } from './run_migration_31';
import { runMigration32 } from './run_migration_32';
import { runMigration33 } from './run_migration_33';
import { runMigration34 } from './run_migration_34';
import { runMigration35 } from './run_migration_35';
import { runMigration36 } from './run_migration_36';
import { runMigration37 } from './run_migration_37';
import { runMigration37 as runMigration37WhatsappMedia } from './run_migration_37_whatsapp_media_url';
import { runMigration38 as runMigration38Base64 } from './run_migration_38_base64_extract';
import { runMigration38 as runMigration38Nfe } from './run_migration_38_nfe_nfce';
import { runMigration39 } from './run_migration_39_whatsapp_queue';
import { runMigration40 } from './run_migration_40_nfe_emitted_at';
import runMigration41 from './run_migration_41_chart_of_accounts';
import runMigration42 from './run_migration_42_nature';
import runMigration43 from './run_migration_43_accounting_entries';
import { runMigration44 } from './run_migration_44_drop_company_whatsapp_official';
import { runMigration45 } from './run_migration_45_whatsapp_user_mode';
import runMigration44EasyCode from './run_migration_44_chart_of_accounts_easy_code';
import runMigration46 from './run_migration_46_whatsapp_phone_aliases';
import runMigration47 from './run_migration_47_whatsapp_normalize_alias_history';
import runMigration48 from './run_migration_48_tasks';
import runMigration49 from './run_migration_49_organizer_states';
import runMigration50 from './run_migration_50_whatsapp_sessions';
import runMigration51 from './run_migration_51_bank_accounts_pix_key';
import runMigration51SwaggerToken from './run_migration_51_swagger_token';
import runMigration52 from './run_migration_52_company_logo';
import runMigration53 from './run_migration_53_product_images';
import runMigration54 from './run_migration_54_customers_credit_fields';
import runMigration55 from './run_migration_55_soft_delete_sales_picking';
import runMigration56 from './run_migration_56_audit_logs';
import runMigration57EmailConfig from './run_migration_57_email_config';
import runMigration58 from './run_migration_58_sales_progress_status';
import runMigration59AjustePermissions from './run_migration_59_ajuste_permissions';
import { runMigration60 as runMigration60RawPassword } from './run_migration_60';
import runMigration60SalesNfeXmlFields from './run_migration_60_sales_nfe_xml_fields';
import { runMigration60 as runMigration60RelatedPersons } from './run_migration_60_transactions_related_persons';
import runMigration61ServiceTypesPermissions from './run_migration_61_service_types_permissions';
import runMigration62ServiceTypes from './run_migration_62_service_types';
import runMigration63Services from './run_migration_63_services';
import runMigration64ServicesTaxFields from './run_migration_64_services_tax_fields';
import runMigration65ServiceTaxPermissions from './run_migration_65_service_tax_permissions';
import runMigration66ServicesServiceTypeRelation from './run_migration_66_services_service_type_relation';
import runMigration67ServicesMunicipalTaxReference from './run_migration_67_services_municipal_tax_reference';
import runMigration68ServicesFederalTaxReference from './run_migration_68_services_federal_tax_reference';
import runMigration69ServiceLaunches from './run_migration_69_service_launches';
import runMigration70EmailConfigImap from './run_migration_70_email_config_imap';
import runMigration71StockVisionPermissions from './run_migration_71_stock_vision_permissions';
import runMigration72FinanceVisionPermissions from './run_migration_72_finance_vision_permissions';
import runMigration73StockTypes from './run_migration_73_stock_types';
import runMigration74ProductStockType from './run_migration_74_product_stock_type';
import runMigration75ServiceLaunchesNfseStatus from './run_migration_75_service_launches_nfse_status';
import runMigration76CustomerDiscount from './run_migration_76_customer_discount';
import runMigration77AccountingAutoEntries from './run_migration_77_accounting_auto_entries';
import runMigration78AccountingHistories from './run_migration_78_accounting_histories';
import runMigration79CustomerDeclarations from './run_migration_79_customer_declarations';
import runMigration80CustomerFields from './run_migration_80_customer_fields';
import runMigration80DeclarationValues from './run_migration_80_declaration_values';
import runMigration81AccumulatedRevenue from './run_migration_81_accumulated_revenue';
import runMigration82DocumentPeriod from './run_migration_82_document_period';
import runMigration83DeclarationTypes from './run_migration_83_declaration_types';
import runMigration84DeclarationRegistrationPermissions from './run_migration_84_declaration_registration_permissions';
import runMigration85AddTaxRegimeToDeclarationTypes from './run_migration_85_add_tax_regime_to_declaration_types';
import runMigration86QuoteStatus from './run_migration_86_quote_status';
import runMigration87QuotesFields from './run_migration_87_quotes_fields';
import runMigration88QuotesPermissions from './run_migration_88_quotes_permissions';
import { runMigration89QuoteServices } from './run_migration_89_quote_services';
import { runMigration90QuoteManualCustomerAndBrand } from './run_migration_90_quote_manual_customer_and_brand';
import { runMigration91QuotePaymentAndTerms } from './run_migration_91_quote_payment_and_terms';
import { runMigration92SolidconDorsalFields } from './run_migration_92_solidcon_dorsal_fields';
import { runMigration93AddCdfilial } from './run_migration_93_add_cdfilial';
import { runMigration94BankAccountsWebhookFields } from './run_migration_94_bank_accounts_webhook_fields';
import { runMigration95BankAccountsWebhookCerts } from './run_migration_95_bank_accounts_webhook_certs';
import { runMigration96FinanceCategoryTypes } from './run_migration_96_finance_category_types';
import { runMigration97BankAccountsWebhookBoleto } from './run_migration_97_bank_accounts_webhook_boleto';
import { runMigration98BankStatements } from './run_migration_98_bank_statements';
import { runMigration99AddAdminBasicRole } from './run_migration_99_add_admin_basic_role';
import runMigration100NotasComprasPermissions from './run_migration_100_notas_compras_permissions';
import runMigration101ReceivableTypes from './run_migration_101_receivable_types';
import runMigration102CardConfigurations from './run_migration_102_card_configurations';
import runMigration103CardBrands from './run_migration_103_card_brands';
import runMigration104CardConfigPaymentType from './run_migration_104_card_config_payment_type';
import runMigration105CompanyShowSolidcon from './run_migration_105_company_show_solidcon';
import runMigration106TransactionCardBrand from './run_migration_106_transaction_card_brand';
import { runMigration107 } from './run_migration_107_cnpj_document_url_text';
import { runMigration108 } from './run_migration_108_contacts_birth_date';
import { runMigration109 } from './run_migration_109_employees';
import { runMigration110 } from './run_migration_110_customer_notes';
import { runMigration111 } from './run_migration_111_transaction_pix_key';
import { runMigration112 } from './run_migration_112_services_cost_and_tax';
import { runMigration113 } from './run_migration_113_services_markup_and_total_cost';
import { runMigration114 } from './run_migration_114_company_general_admin';
import { runMigration115 } from './run_migration_115_customer_contact';
import runMigration116PaymentTypes from './run_migration_116_payment_types';
import { runMigration117 } from './run_migration_117_transaction_payment_method_varchar';
import { runMigration118 } from './run_migration_118_transaction_scheduled_status';
import runMigration119CustomerGroups from './run_migration_119_customer_groups';
import runMigration120Fechamentos from './run_migration_120_fechamentos';
import { runMigration121AddTradeNameToCustomers } from './run_migration_121_add_trade_name_to_customers';
import { runMigration122CardExpenses } from './run_migration_122_card_expenses';
import { runMigration123AddTempo } from './run_migration_123_add_tempo';
import { runMigration124CardExpensesCategory } from './run_migration_124_card_expenses_category';
import { runMigration125ServiceLaunchesAddProduct } from './run_migration_125_service_launches_add_product';
import { runMigration126FechamentosAddAjustes } from './run_migration_126_fechamentos_add_ajustes';
import { runMigration127FechamentosAddSimples } from './run_migration_127_fechamentos_add_simples';
import { runMigration128FechamentosAddSimplesTaxes } from './run_migration_128_fechamentos_add_simples_taxes';
import { runMigration129FechamentosAddSimplesTaxedUntaxed } from './run_migration_129_fechamentos_add_simples_taxed_untaxed';
import { runMigration130ServiceLaunchesChecklist } from './run_migration_130_service_launches_checklist';
import { runMigration131FechamentosAddObservacao } from './run_migration_131_fechamentos_add_observacao';
import { runMigration132ContactNotes } from './run_migration_132_contact_notes';
import { runMigration133SupplierNotes } from './run_migration_133_supplier_notes';
import { runMigration134ContactsCnpjDocumentUrlText } from './run_migration_134_contacts_cnpj_document_url_text';
import { runMigration135 } from './run_migration_135_company_waze_url';
import { runMigration136 } from './run_migration_136_users_cnpj_document_url';
import { runMigration137 } from './run_migration_137_company_cnpj_document_url';
import { runMigration138 } from './run_migration_138_transaction_billet_batch_generated';
import { runMigration139CardDebits } from './run_migration_139_card_debits';
import { runMigration140CardDebitsFields } from './run_migration_140_card_debits_fields';
import { runMigration141CardExpensesCardDebit } from './run_migration_141_card_expenses_card_debit';
import { runMigration142EntityCertificateName } from './run_migration_142_entity_certificate_name';
import { runMigration143PurchaseNfeFields } from './run_migration_143_purchase_nfe_fields';
import { runMigration145CensusCountryData } from './run_migration_145_census_country_data';
import { runMigration146MecDataTables } from './run_migration_146_mec_data_tables';
import { runMigration147MecPermissions } from './run_migration_147_mec_permissions';
import { runMigration144CensusVisionPermissions } from './run_migration_144_census_vision_permissions';
import { runMigration148AlignRolePermissions } from './run_migration_148_align_role_permissions';
import { runMigration149EnemApprovedTable } from './run_migration_149_enem_approved_table';
import { runMigration150EnemAddYear } from './run_migration_150_enem_add_year';
import { runMigration151EnemAdd2025 } from './run_migration_151_enem_add_2025';
import { runMigration152EnemAddNiteroiSchools } from './run_migration_152_enem_add_niteroi_schools';
import { runMigration153IncomeVisionPermissions } from './run_migration_153_income_vision_permissions';
import { runMigration154EnemAddRegisteredCount } from './run_migration_154_enem_add_registered_count';
import { runMigration155EnemAddMoreNiteroiSchools } from './run_migration_155_enem_add_more_niteroi_schools';
import { runMigration156EnemAddBabylandiaNiteroi } from './run_migration_156_enem_add_babylandia_niteroi';
import { runMigration157EnemAddAverageScoreColumn } from './run_migration_157_enem_add_average_score_column';
import { runMigration158EnemForceSeedAverageScore } from './run_migration_158_enem_force_seed_average_score';
import { runMigration159CreateSisuProfessionsTable } from './run_migration_159_create_sisu_professions_table';
import { runMigration160AddCensusPopulation } from './run_migration_160_add_census_population';
import { runMigration161CreatePnadIncomeTable } from './run_migration_161_create_pnad_income_table';
import { runMigration162AddSchoolCnpjColumn } from './run_migration_162_add_school_cnpj_column';
import { runMigration163CreateEnemStudentsTable } from './run_migration_163_create_enem_students_table';
import { runMigration164RecreateEnemStudentsWithFullNames } from './run_migration_164_recreate_enem_students_with_full_names';
import { runMigration165AddStudentType } from './run_migration_165_add_student_type';
import { runMigration166OfficialEnemScores } from './run_migration_166_official_enem_scores';
import { runMigration167AddIdprodutoposToProducts } from './run_migration_167_add_idprodutopos_to_products';
import { runMigration168AddIdgrupoposToProductCategories } from './run_migration_168_add_idgrupopos_to_product_categories';
import { runMigration169CreateCompanyPoscontrolConfigsTable } from './run_migration_169_create_company_poscontrol_configs_table';
import { runMigration170AddUrlProductgroupsPostToCompanyPoscontrolConfigs } from './run_migration_170_add_url_productgroups_post_to_company_poscontrol_configs';
import { runMigration171AddPoscontrolUsernameAndPasswordToCompanyPoscontrolConfigs } from './run_migration_171_add_poscontrol_username_and_password_to_company_poscontrol_configs';
import { runMigration172AddPoscontrolSyncedToProductsAndCategories } from './run_migration_172_add_poscontrol_synced_to_products_and_categories';
import { runMigration173AddIdmedidaposToMeasures } from './run_migration_173_add_idmedidapos_to_measures';
import runMigration174CreateProductTypes from './run_migration_174_create_product_types';
import { runMigration175AddIdprodutotipoposToProductTypes } from './run_migration_175_add_idprodutotipopos_to_product_types';
import { runMigration176AddProductTypeIdToProducts } from './run_migration_176_add_product_type_id_to_products';
import { runMigration177AddActiveToProductCategories } from './run_migration_177_add_active_to_product_categories';
import { runMigration178AddActiveToProducts } from './run_migration_178_add_active_to_products';
import { runMigration179AddDefaultCustomerGroupToCompanies } from './run_migration_179_add_default_customer_group_to_companies';
import { runMigration180AddDefaultBankAndReceivableToCompanies } from './run_migration_180_add_default_bank_and_receivable_to_companies';
import { runMigration181AddAutoGenerateBilletsToCompanies } from './run_migration_181_add_auto_generate_billets_to_companies';
import { runMigration182AddWhatsappBoletoParametersToCompanies } from './run_migration_182_add_whatsapp_boleto_parameters_to_companies';
import { runMigration183TransactionNetAmount } from './run_migration_183_transaction_net_amount';
import { runMigration184TransactionCardConfiguration } from './run_migration_184_transaction_card_configuration';
import { runMigration185ProductStatusPosId } from './run_migration_185_product_status_pos_id';
import { runMigration186SolidconCustomerFields } from './run_migration_186_solidcon_customer_fields';
import { runMigration187AddDateLaunchToTransactions } from './run_migration_187_add_date_launch_to_transactions';
import { runMigration188CompanyGroups } from './run_migration_188_company_groups';
import { runMigration189BankAccountsBilletSettings } from './run_migration_189_bank_accounts_billet_settings';
import { runMigration190UserDefaultBankAccount } from './run_migration_190_user_default_bank_account';
import { runMigration191PixOperatorRole } from './run_migration_191_pix_operator_role';
import { runMigration192UserRoleToVarchar } from './run_migration_192_user_role_to_varchar';
import { runMigration193CompanyWhatsappScopeToUser } from './run_migration_193_company_whatsapp_scope_to_user';
import { runMigration194AddWhatsappManualBilling } from './run_migration_194_add_whatsapp_manual_billing';
import { runMigration195AddWhatsappAutoSendBoleto } from './run_migration_195_add_whatsapp_auto_send_boleto';
import { runMigration196AddInscricaoToCustomers } from './run_migration_196_add_inscricao_to_customers';
import { runMigration197AddCdpdvToCompanies } from './run_migration_197_add_cdpdv_to_companies';
import { runMigration198AddPdvToTransactions } from './run_migration_198_add_pdv_to_transactions';
import { runMigration199AddCdfilialToTransactions } from './run_migration_199_add_cdfilial_to_transactions';
import { runMigration200AddSolidconQuitadoToTransactions } from './run_migration_200_add_solidcon_quitado_to_transactions';
import { runMigration201AddSolidconKeyToTransactions } from './run_migration_201_add_solidcon_key_to_transactions';
import runMigration150SpedFiscalPermissions from './run_migration_150_sped_fiscal_permissions';
import runMigration151SpedFiscalVisionPermissions from './run_migration_151_sped_fiscal_vision_permissions';
import { runMigration217FechamentosSpedDataJson } from './run_migration_217_fechamentos_sped_data_json';
import { runMigration219SingleSessionPerUser } from './run_migration_219_single_session_per_user';
import { runMigration220FechamentosFecp } from './run_migration_220_fechamentos_fecp';
import { runMigration221CompanyGroupMaster } from './run_migration_221_company_group_master';
import { runMigration223PopulateSolidconKeyInTransactions } from './run_migration_223_populate_solidcon_key_in_transactions';
import { runMigration100DentalOdontogram } from './run_migration_100_dental_odontogram';
import { runMigration101DentalPermissions } from './run_migration_101_dental_permissions';
import { runMigration256CompanyShowPoscontrol } from './run_migration_256_company_show_poscontrol';
import runMigration257RelValorEmpresaPermissions from './run_migration_257_rel_valor_empresa_permissions';
import { runMigration258FechamentosNullableCustomer } from './run_migration_258_fechamentos_nullable_customer';




type SeedRole = 'admin' | 'operator' | 'financial' | 'seller' | 'contact' | 'accountant' | 'buyer' | 'service_provider' | 'user' | 'super_admin' | 'admin_basic' | 'supervisor' | 'pix_operator' | 'solidcon' | 'auxiliar_contador' | 'socio';

type CompanyRow = RowDataPacket & {
    id: number;
    public_id: string;
    trade_name: string;
    is_system: 0 | 1 | boolean;
};

const DB_NAME = process.env.DB_NAME || 'bessa_erp';
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS || '10', 10);
const DEFAULT_VISIBLE_COMPANY_NAME = 'Empresa Padrao';
const SYSTEM_COMPANY_NAME = 'Sistema Keystone';

const ALL_MODULES = [
    'sales',
    'quotes',
    'service_launches',
    'restaurant',
    'dashboard',
    'finance_vision',
    'stock_vision',
    'whatsapp-info',
    'picking',
    'nota',
    'notas_vendidas',
    'products',
    'categories',
    'stock_types',
    'product_types',
    'manufacturers',
    'taxes',
    'prices',
    'measures',
    'service_types',
    'services',
    'service_tax_municipal',
    'service_tax_federal',
    'purchases',
    'notas_compras',
    'manifestation',
    'expenses',
    'card_debits',
    'card_expenses',
    'card_brands',
    'card_configurations',
    'payment_types',
    'revenues',
    'finance_categories',
    'finance_category_types',
    'banks',
    'statements',
    'customers',
    'customer_groups',
    'contacts',
    'sellers',
    'buyers',
    'service_providers',
    'suppliers',
    'employees',
    'company',
    'accountant',
    'socio',
    'users',
    'accounting',
    'accounting_entries',
    'accounting_auto_entries',
    'accounting_auto_history',
    'accounting_closing',
    'declaration_registration',
    'declaration_control',
    'fechamento',
    'sped_fiscal',
    'sped_fiscal_vision',
    'dre',
    'balanco',
    'balancete',
    'roles',
    'tasks',
    'organizer',
    'ajuste',
    'whatsapp',
    'email',
    'receivable_types',
    'swagger',
    'census-vision',
    'mec-vision',
    'rel_rafael',
    'rel_pedido_dorsal',
    'rel_saldo_banco',
    'cost_centers',
    'odontogram'
] as const;

const ROLE_MODULES: Record<SeedRole, readonly string[]> = {
    admin: ALL_MODULES,
    operator: ['dashboard', 'sales', 'restaurant', 'picking', 'nota', 'census-vision', 'mec-vision'],
    financial: [
        'dashboard', 'finance_vision', 'expenses', 'card_debits', 'card_expenses', 
        'card_brands', 'card_configurations', 'payment_types', 'revenues', 
        'finance_categories', 'finance_category_types', 'banks', 'statements', 
        'purchases', 'notas_compras', 'accountant', 'socio', 'receivable_types', 
        'fechamento', 'sped_fiscal', 'sped_fiscal_vision', 'census-vision', 'mec-vision', 'rel_rafael', 'cost_centers'
    ],
    seller: [
        'dashboard', 'sales', 'customers', 'contacts', 'sellers', 
        'customer_groups', 'employees', 'census-vision', 'mec-vision'
    ],
    contact: ['dashboard', 'contacts'],
    accountant: ['dashboard', 'company', 'accountant', 'fechamento', 'sped_fiscal', 'sped_fiscal_vision', 'census-vision', 'mec-vision'],
    socio: ['dashboard', 'company', 'socio', 'census-vision', 'mec-vision'],
    buyer: ['dashboard', 'purchases', 'notas_compras', 'suppliers', 'buyers', 'census-vision', 'mec-vision'],
    service_provider: ['dashboard', 'service_providers', 'census-vision', 'mec-vision'],
    user: ['dashboard', 'census-vision', 'mec-vision'],
    super_admin: ALL_MODULES,
    admin_basic: ALL_MODULES,
    supervisor: ALL_MODULES,
    pix_operator: ['dashboard', 'gera-pix'],
    solidcon: ['dashboard', 'rel_rafael'],
    auxiliar_contador: ['dashboard', 'company', 'fechamento', 'sped_fiscal', 'sped_fiscal_vision', 'census-vision', 'mec-vision'],
};

export const DEFAULT_COMPANY_USERS: Array<{ fullName: string; role: Exclude<SeedRole, 'super_admin'>; emailPrefix: string }> = [
    { fullName: 'Administrador', role: 'admin', emailPrefix: 'administrador' },
    { fullName: 'Operador', role: 'operator', emailPrefix: 'operador' },
    { fullName: 'Financeiro', role: 'financial', emailPrefix: 'financeiro' },
    { fullName: 'Usuario Comum', role: 'user', emailPrefix: 'usuario' },
];

function makeBaseConnectionConfig(): ConnectionOptions {
    const config: ConnectionOptions = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_MIGRATION_USER || process.env.MARIADB_ROOT_USER || process.env.DB_USER || 'root',
        password: process.env.DB_MIGRATION_PASSWORD || process.env.MARIADB_ROOT_PASSWORD || process.env.DB_PASSWORD || '',
        port: parseInt(process.env.DB_PORT || '3306', 10),
    };

    if (process.env.MYSQL_UNIX_PORT) {
        config.socketPath = process.env.MYSQL_UNIX_PORT;
    }

    return config;
}

function escapeIdentifier(identifier: string): string {
    return `\`${identifier.replace(/`/g, '``')}\``;
}

function normalizeSchemaDatabase(sql: string): string {
    const escapedDbName = escapeIdentifier(DB_NAME);

    return sql
        .replace(/CREATE DATABASE IF NOT EXISTS\s+`?[^`;]+`?;/i, `CREATE DATABASE IF NOT EXISTS ${escapedDbName};`)
        .replace(/USE\s+`?[^`;]+`?;/i, `USE ${escapedDbName};`);
}

export function makeCompanySeedEmail(prefix: string, companyId: number): string {
    return `${prefix}+empresa-${companyId}@keystone.local`;
}

async function ensureDatabaseExists(): Promise<void> {
    const connection = await mysql.createConnection(makeBaseConnectionConfig());

    try {
        await connection.query(
            `CREATE DATABASE IF NOT EXISTS ${escapeIdentifier(DB_NAME)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
        );
    } finally {
        await connection.end();
    }
}

async function applyCanonicalSchema(): Promise<void> {
    const schemaSql = normalizeSchemaDatabase(CANONICAL_SCHEMA_SQL);
    const connection = await mysql.createConnection({
        ...makeBaseConnectionConfig(),
        database: DB_NAME,
        multipleStatements: true,
    });

    try {
        await connection.query(schemaSql);
    } finally {
        await connection.end();
    }
}

async function getCompanyById(id: number): Promise<CompanyRow> {
    const [rows] = await pool.query<CompanyRow[]>(
        'SELECT id, public_id, trade_name, is_system FROM companies WHERE id = ? LIMIT 1',
        [id]
    );

    if (!rows[0]) {
        throw new Error(`Company ${id} not found after insert`);
    }

    return rows[0];
}

async function ensureSystemCompany(): Promise<CompanyRow> {
    const [existingRows] = await pool.query<CompanyRow[]>(
        `SELECT id, public_id, trade_name, is_system
         FROM companies
         WHERE is_system = TRUE
         ORDER BY id ASC
         LIMIT 1`
    );

    if (existingRows[0]) {
        console.log(`[SKIP] system company already exists: ${existingRows[0].trade_name}`);
        return existingRows[0];
    }

    const publicId = randomUUID();
    const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO companies (public_id, trade_name, company_name, is_active, is_system)
         VALUES (?, ?, ?, TRUE, TRUE)`,
        [publicId, SYSTEM_COMPANY_NAME, SYSTEM_COMPANY_NAME]
    );

    console.log(`[OK] system company created: ${SYSTEM_COMPANY_NAME}`);
    return getCompanyById(result.insertId);
}

async function ensureAtLeastOneVisibleCompany(): Promise<void> {
    const [visibleCompanies] = await pool.query<CompanyRow[]>(
        `SELECT id, public_id, trade_name, is_system
         FROM companies
         WHERE is_system = FALSE
         LIMIT 1`
    );

    if (visibleCompanies[0]) {
        console.log('[SKIP] at least one visible company already exists');
        return;
    }

    const publicId = randomUUID();
    await pool.query<ResultSetHeader>(
        `INSERT INTO companies (public_id, trade_name, company_name, is_active, is_system)
         VALUES (?, ?, ?, TRUE, FALSE)`,
        [publicId, DEFAULT_VISIBLE_COMPANY_NAME, DEFAULT_VISIBLE_COMPANY_NAME]
    );

    console.log(`[OK] default visible company created: ${DEFAULT_VISIBLE_COMPANY_NAME}`);
}

export async function getVisibleCompanies(): Promise<CompanyRow[]> {
    const [rows] = await pool.query<CompanyRow[]>(
        `SELECT id, public_id, trade_name, is_system
         FROM companies
         WHERE is_system = FALSE
         ORDER BY id ASC`
    );

    return rows;
}

async function ensureRolePermissions(companyId: number, role: SeedRole, modules: readonly string[]): Promise<void> {
    for (const module of modules) {
        await pool.query<ResultSetHeader>(
            `INSERT IGNORE INTO role_permissions (company_id, role, module, can_view)
             VALUES (?, ?, ?, TRUE)`,
            [companyId, role, module]
        );
    }
}

async function seedSuperAdmin(systemCompanyId: number): Promise<void> {
    const email = 'superadmin@keystone.local';
    const [existingUsers] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM users WHERE email = ? LIMIT 1',
        [email]
    );

    if (existingUsers.length > 0) {
        console.log(`[SKIP] superadmin user already exists: ${email}. Senha preservada.`);
        await ensureRolePermissions(systemCompanyId, 'super_admin', ROLE_MODULES.super_admin);
        return;
    }

    const initialPassword = process.env.SUPERADMIN_INITIAL_PASSWORD;
    if (!initialPassword || initialPassword.length < 12) {
        console.warn('⚠️  [SECURITY WARNING] SUPERADMIN_INITIAL_PASSWORD não informada ou com menos de 12 caracteres. Criação do superadmin inicial ignorada por segurança.');
        return;
    }

    const passwordHash = await bcrypt.hash(initialPassword, SALT_ROUNDS);
    await pool.query<ResultSetHeader>(
        `INSERT INTO users (public_id, company_id, email, password_hash, full_name, role, is_active)
         VALUES (?, ?, ?, ?, ?, 'super_admin', TRUE)`,
        [randomUUID(), systemCompanyId, email, passwordHash, 'Super Admin']
    );

    console.log(`[OK] superadmin user created: ${email}`);
    await ensureRolePermissions(systemCompanyId, 'super_admin', ROLE_MODULES.super_admin);
}

async function runInitDb(): Promise<void> {
    console.log('');
    console.log('┌──────────────────────────────────────────────────────────────┐');
    console.log('│  initdb: canonical schema, migrations and seed              │');
    console.log('└──────────────────────────────────────────────────────────────┘');
    console.log('');

    console.log(`[INFO] target database: ${DB_NAME}`);
    await ensureDatabaseExists();
    await applyCanonicalSchema();

    // Ensure schema_migrations table exists for tracking migration history
    await pool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INT UNSIGNED NOT NULL PRIMARY KEY,
            description VARCHAR(255) NOT NULL,
            aplicado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await runMigration18();
    await runMigration19();
    await runMigration21();
    await runMigration22();
    await runMigration23();
    await runMigration24();
    await runMigration25();
    await runMigration26();
    await runMigration27();
    await runMigration28();
    await runMigration29();
    await runMigration30();
    await runMigration31();
    await runMigration32();
    await runMigration33();
    await runMigration34();
    await runMigration35();
    await runMigration36();
    await runMigration37();
    await runMigration37WhatsappMedia();
    await runMigration38Base64();
    await runMigration38Nfe();
    await runMigration39();
    await runMigration40();
    await runMigration41();
    await runMigration42();
    await runMigration43();
    await runMigration44();
    await runMigration45();
    await runMigration44EasyCode();
    await runMigration46();
    await runMigration47();
    await runMigration48();
    await runMigration49();
    await runMigration50();
    await runMigration51();
    await runMigration51SwaggerToken();
    await runMigration52();
    await runMigration53();
    await runMigration54();
    await runMigration55();
    await runMigration56();
    await runMigration57EmailConfig();
    await runMigration58();
    await runMigration59AjustePermissions();
    await runMigration60RawPassword();
    await runMigration60SalesNfeXmlFields();
    await runMigration60RelatedPersons();
    await runMigration61ServiceTypesPermissions();
    await runMigration62ServiceTypes();
    await runMigration63Services();
    await runMigration64ServicesTaxFields();
    await runMigration65ServiceTaxPermissions();
    await runMigration66ServicesServiceTypeRelation();
    await runMigration67ServicesMunicipalTaxReference();
    await runMigration68ServicesFederalTaxReference();
    await runMigration69ServiceLaunches();
    await runMigration70EmailConfigImap();
    await runMigration71StockVisionPermissions();
    await runMigration72FinanceVisionPermissions();
    await runMigration73StockTypes();
    await runMigration74ProductStockType();
    await runMigration75ServiceLaunchesNfseStatus();
    await runMigration76CustomerDiscount();
    await runMigration77AccountingAutoEntries();
    await runMigration78AccountingHistories();
    await runMigration79CustomerDeclarations();
    await runMigration80CustomerFields();
    await runMigration80DeclarationValues();
    await runMigration81AccumulatedRevenue();
    await runMigration82DocumentPeriod();
    await runMigration83DeclarationTypes();
    await runMigration84DeclarationRegistrationPermissions();
    await runMigration85AddTaxRegimeToDeclarationTypes();
    await runMigration86QuoteStatus();
    await runMigration87QuotesFields();
    await runMigration88QuotesPermissions();
    await runMigration89QuoteServices();
    await runMigration90QuoteManualCustomerAndBrand();
    await runMigration91QuotePaymentAndTerms();
    await runMigration92SolidconDorsalFields();
    await runMigration93AddCdfilial();
    await runMigration94BankAccountsWebhookFields();
    await runMigration95BankAccountsWebhookCerts();
    await runMigration96FinanceCategoryTypes();
    await runMigration97BankAccountsWebhookBoleto();
    await runMigration98BankStatements();
    await runMigration99AddAdminBasicRole();
    await runMigration100NotasComprasPermissions();
    await runMigration101ReceivableTypes();
    await runMigration102CardConfigurations();
    await runMigration103CardBrands();
    await runMigration104CardConfigPaymentType();
    await runMigration105CompanyShowSolidcon();
    await runMigration106TransactionCardBrand();
    await runMigration107();
    await runMigration108();
    await runMigration109();
    await runMigration110();
    await runMigration111();
    await runMigration112();
    await runMigration113();
    await runMigration114();
    await runMigration115();
    await runMigration116PaymentTypes();
    await runMigration117();
    await runMigration118();
    await runMigration119CustomerGroups();
    await runMigration120Fechamentos();
    await runMigration121AddTradeNameToCustomers();
    await runMigration122CardExpenses();
    await runMigration123AddTempo();
    await runMigration124CardExpensesCategory();
    await runMigration125ServiceLaunchesAddProduct();
    await runMigration126FechamentosAddAjustes();
    await runMigration127FechamentosAddSimples();
    await runMigration128FechamentosAddSimplesTaxes();
    await runMigration129FechamentosAddSimplesTaxedUntaxed();
    await runMigration130ServiceLaunchesChecklist();
    await runMigration131FechamentosAddObservacao();
    await runMigration132ContactNotes();
    await runMigration133SupplierNotes();
    await runMigration134ContactsCnpjDocumentUrlText();
    await runMigration135();
    await runMigration136();
    await runMigration137();
    await runMigration138();
    await runMigration139CardDebits();
    await runMigration140CardDebitsFields();
    await runMigration141CardExpensesCardDebit();
    await runMigration142EntityCertificateName();
    await runMigration143PurchaseNfeFields();
    await runMigration144CensusVisionPermissions();
    await runMigration145CensusCountryData();
    await runMigration146MecDataTables();
    await runMigration147MecPermissions();
    await runMigration148AlignRolePermissions();
    await runMigration149EnemApprovedTable();
    await runMigration150EnemAddYear();
    await runMigration151EnemAdd2025();
    await runMigration152EnemAddNiteroiSchools();
    await runMigration153IncomeVisionPermissions();
    await runMigration154EnemAddRegisteredCount();
    await runMigration155EnemAddMoreNiteroiSchools();
    await runMigration156EnemAddBabylandiaNiteroi();
    await runMigration157EnemAddAverageScoreColumn();
    await runMigration158EnemForceSeedAverageScore();
    await runMigration159CreateSisuProfessionsTable();
    await runMigration160AddCensusPopulation();
    await runMigration161CreatePnadIncomeTable();
    await runMigration162AddSchoolCnpjColumn();
    await runMigration163CreateEnemStudentsTable();
    await runMigration164RecreateEnemStudentsWithFullNames();
    await runMigration165AddStudentType();
    await runMigration166OfficialEnemScores();
    await runMigration167AddIdprodutoposToProducts();
    await runMigration168AddIdgrupoposToProductCategories();
    await runMigration169CreateCompanyPoscontrolConfigsTable();
    await runMigration170AddUrlProductgroupsPostToCompanyPoscontrolConfigs();
    await runMigration171AddPoscontrolUsernameAndPasswordToCompanyPoscontrolConfigs();
    await runMigration172AddPoscontrolSyncedToProductsAndCategories();
    await runMigration173AddIdmedidaposToMeasures();
    await runMigration174CreateProductTypes();
    await runMigration175AddIdprodutotipoposToProductTypes();
    await runMigration176AddProductTypeIdToProducts();
    await runMigration177AddActiveToProductCategories();
    await runMigration178AddActiveToProducts();
    await runMigration179AddDefaultCustomerGroupToCompanies();
    await runMigration180AddDefaultBankAndReceivableToCompanies();
    await runMigration181AddAutoGenerateBilletsToCompanies();
    await runMigration182AddWhatsappBoletoParametersToCompanies();
    await runMigration183TransactionNetAmount();
    await runMigration184TransactionCardConfiguration();
    await runMigration185ProductStatusPosId();
    await runMigration186SolidconCustomerFields();
    await runMigration187AddDateLaunchToTransactions();
    await runMigration188CompanyGroups();
    await runMigration189BankAccountsBilletSettings();
    await runMigration190UserDefaultBankAccount();
    await runMigration191PixOperatorRole();
    await runMigration192UserRoleToVarchar();
    await runMigration193CompanyWhatsappScopeToUser();
    await runMigration194AddWhatsappManualBilling();
    await runMigration195AddWhatsappAutoSendBoleto();
    await runMigration196AddInscricaoToCustomers();
    await runMigration197AddCdpdvToCompanies();
    await runMigration198AddPdvToTransactions();
    await runMigration199AddCdfilialToTransactions();
    await runMigration200AddSolidconQuitadoToTransactions();
    await runMigration201AddSolidconKeyToTransactions();
    await runMigration202AddSolidconBankIdToBankAccounts();
    await runMigration203CardStatements();
    await runMigration204ReportRafaelPermissions();
    await runMigration205AddSolidconRole();
    await runMigration206ActivityGroups();
    await runMigration207CustomerActivities();
    await runMigration208ActivityGroupsMonthlyFee();
    await runMigration209ActivityGroupsOperationCost();
    await runMigration210AddAuxiliarContadorRole();
    await runMigration211CopyDbCredentials();
    await runMigration212MigrateUiPreferences();
    await runMigration213CreateCostCentersTable();
    await runMigration214AddAlterdataFields();
    await runMigration215AddOnlyPixToCustomers();
    await runMigration216AddCdempresaAlterdata();
    await runMigration150SpedFiscalPermissions();
    await runMigration151SpedFiscalVisionPermissions();
    await runMigration217FechamentosSpedDataJson();
    await runMigration219SingleSessionPerUser();
    await runMigration220FechamentosFecp();
    await runMigration221CompanyGroupMaster();
    await runMigration222TransactionsWhatsappSentInt();
    await runMigration223AddFineInterestToTransactions();
    await runMigration224BankAccountsPixSettings();
    await runMigration225AddReceivedChannelToTransactions();
    await runMigration226RemoveKeystoneInterestTransactions();
    await runMigration227ExpandDeclarationTypesTaxRegime();
    await runMigration228AddSolidconInterestKeyToTransactions();
    await runMigration229UpdateSolidconInterestKeyToConta();
    await runMigration230SyncAllSolidconInterestRevenues();
    await runMigration231ReportPedidosDorsalPermissions();
    await runMigration232ReportSaldoBancoPermissions();
    await runMigration233AddOnlySolidconBaixaToCustomers();
    await runMigration234AddExemptInterestFineToCustomers();
    await runMigration235AddAsaasFieldsToBankAccounts();
    await runMigration236CleanEsgN1Transactions();
    await runMigration237RevenueWhatsappAudits();
    await runMigration238BackfillWhatsappAudits();
    await runMigration240SyncSolidconInterestAndFines();
    await runMigration241FixReceivedAmountWithFines();
    await runMigration242CompanySolidconConfigs();
    await runMigration243CustomerHideInRevenuesGrid();
    await runMigration244ChangeDateLaunchToDatetime();
    await runMigration245FixCorruptedFinesAndInterestKeys();
    await runMigration246CompanyDorsalConfigs();
    await runMigration247CompanyWhatsappAllowAllUsersActiveSender();
    await runMigration248FinSolidconVisionPermissions();
    await runMigration249CompanyAlterdataConfigs();
    await runMigration250AccountingClosings();
    await runMigration251UserDefaultDeclarationSigner();
    await runMigration252SocioModulePermissions();
    await runMigration253CreateErpAppUser();
    await runMigration254EncryptCredentialsAndDropRawPassword();
    await runMigration223PopulateSolidconKeyInTransactions();
    await runMigration100DentalOdontogram();
    await runMigration101DentalPermissions();
    await runMigration256CompanyShowPoscontrol();
    await runMigration257RelValorEmpresaPermissions();
    await runMigration258FechamentosNullableCustomer();
    await normalizeAllDocuments();

    const systemCompany = await ensureSystemCompany();
    await ensureAtLeastOneVisibleCompany();
    // const visibleCompanies = await getVisibleCompanies();

    // Deactivated seed of default company users under user request
    // await seedDefaultCompanyUsers(visibleCompanies);
    await seedSuperAdmin(systemCompany.id);

    console.log('');
    console.log('[OK] initdb completed successfully.');
    console.log('[INFO] Super admin login: superadmin@keystone.local');
}

async function normalizeAllDocuments(): Promise<void> {
    console.log('[INFO] Normalizing all CPF/CNPJ documents to 11 or 14 digits...');
    try {
        // Customers
        await pool.query(
            `UPDATE customers 
             SET cnpj_cpf = LPAD(REPLACE(REPLACE(REPLACE(cnpj_cpf, '.', ''), '-', ''), '/', ''), 11, '0') 
             WHERE LENGTH(REPLACE(REPLACE(REPLACE(cnpj_cpf, '.', ''), '-', ''), '/', '')) BETWEEN 1 AND 10`
        );
        await pool.query(
            `UPDATE customers 
             SET cnpj_cpf = LPAD(REPLACE(REPLACE(REPLACE(cnpj_cpf, '.', ''), '-', ''), '/', ''), 14, '0') 
             WHERE LENGTH(REPLACE(REPLACE(REPLACE(cnpj_cpf, '.', ''), '-', ''), '/', '')) BETWEEN 12 AND 13`
        );

        // Suppliers
        await pool.query(
            `UPDATE suppliers 
             SET cnpj_cpf = LPAD(REPLACE(REPLACE(REPLACE(cnpj_cpf, '.', ''), '-', ''), '/', ''), 11, '0') 
             WHERE LENGTH(REPLACE(REPLACE(REPLACE(cnpj_cpf, '.', ''), '-', ''), '/', '')) BETWEEN 1 AND 10`
        );
        await pool.query(
            `UPDATE suppliers 
             SET cnpj_cpf = LPAD(REPLACE(REPLACE(REPLACE(cnpj_cpf, '.', ''), '-', ''), '/', ''), 14, '0') 
             WHERE LENGTH(REPLACE(REPLACE(REPLACE(cnpj_cpf, '.', ''), '-', ''), '/', '')) BETWEEN 12 AND 13`
        );

        // Contacts
        await pool.query(
            `UPDATE contacts 
             SET cnpj_cpf = LPAD(REPLACE(REPLACE(REPLACE(cnpj_cpf, '.', ''), '-', ''), '/', ''), 11, '0') 
             WHERE LENGTH(REPLACE(REPLACE(REPLACE(cnpj_cpf, '.', ''), '-', ''), '/', '')) BETWEEN 1 AND 10`
        );
        await pool.query(
            `UPDATE contacts 
             SET cnpj_cpf = LPAD(REPLACE(REPLACE(REPLACE(cnpj_cpf, '.', ''), '-', ''), '/', ''), 14, '0') 
             WHERE LENGTH(REPLACE(REPLACE(REPLACE(cnpj_cpf, '.', ''), '-', ''), '/', '')) BETWEEN 12 AND 13`
        );

        // Companies
        await pool.query(
            `UPDATE companies 
             SET cnpj = LPAD(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '-', ''), '/', ''), 14, '0') 
             WHERE LENGTH(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '-', ''), '/', '')) BETWEEN 1 AND 13`
        );

        console.log('[OK] Document normalization completed.');
    } catch (e) {
        console.error('[WARN] Failed to normalize documents:', e);
    }
}

runInitDb()
    .catch((error) => {
        console.error('[FAIL] initdb failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
