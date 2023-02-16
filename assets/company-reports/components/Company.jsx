import React, {Fragment} from 'react';
import PropTypes from 'prop-types';
import {gettext, formatDate, upperCaseFirstCharacter, isInPast} from 'utils';
import { get, groupBy } from 'lodash';
import ReportsTable from './ReportsTable';
import DropdownFilter from "../../components/DropdownFilter";
import {runReport, toggleFilterAndQuery} from "../actions";
import {connect} from "react-redux";

class Company extends React.Component {
    constructor(props, context) {
        super(props, context);

        this.companies = [...this.props.companies.map((c) => ({...c, 'label': c.name}))];
        this.props.reportParams.company = null;
        this.props.reportParams.status = null;
        this.props.reportParams.account_manager = null;
        this.props.reportParams.section = null;
        this.getDropdownItems = this.getDropdownItems.bind(this);

        this.filters = [{
            label: gettext('All Companies'),
            field: 'company'
        },
        {
            label: gettext('Active'),
            field: 'status'
        },
        {
            label: gettext('Account Manager'),
            field: 'account_manager'
        },
        {
            label: gettext('All Sections'),
            field: 'section'
        }];
    }

    componentWillMount() {
        // Run report on initial loading with default filters
        this.props.runReport();
    }

    getDropdownItems(filter) {
        const { toggleFilterAndQuery, sections } = this.props;
        let getName = (text) => (text);
        let itemsArray = [];
        switch (filter.field) {
        case 'company':
            itemsArray = this.companies;
            break;

        case 'status':
            itemsArray = [{
                name: 'true'
            },
            {
                name: 'false'
            }];
            getName = upperCaseFirstCharacter;
            break;

        case 'account_manager':
            itemsArray = [{name: 'None'}];
            let tmpArray = [];
            const companiesByAccountManager = groupBy(this.companies, (c) => c.account_manager);
            const getAccountManager = (accountManager) => {
                if (accountManager === '' || accountManager === 'undefined') {
                    return gettext('None');
                }
                return accountManager;
            };
            Object.keys(companiesByAccountManager).forEach(accountManager =>
                tmpArray.push(getAccountManager(accountManager)));
            tmpArray.sort().map(item => {
                if (itemsArray.findIndex(i => i.name === item) === -1) {
                    itemsArray.push({name: item});
                }
            });
            break;

        case 'section':
            itemsArray = sections;
            break;

        }
        return itemsArray.map((item, i) => (<button
            key={i}
            className='dropdown-item'
            onClick={() => toggleFilterAndQuery(filter.field, item.name)}
        >{getName(item.name)}</button>));
    }

    getFilterLabel(filter, activeFilter) {
        if (activeFilter[filter.field]) {
            return activeFilter[filter.field];
        } else {
            return filter.label;
        }
    }

    getProductDetails(products = []) {
        const { sections } = this.props;
        const productsByGroup = groupBy(products, (p) => p.product_type);
        const getProductSectionName = (productType) => {
            let section = sections.find(s => s._id === productType);
            return section ? section.name : productType;
        };

        if (products.length > 0) {
            return (
                <div className="d-flex m-2">
                    <div><span className="font-italic">{gettext('Products')}: </span></div>
                    {Object.keys(productsByGroup).map((productType) =>
                        <div className='pl-3' key={productType}>{getProductSectionName(productType)}
                            <div className='pl-3'>{productsByGroup[productType].map((p) => <div
                                key={p._id}>{p.name}</div>)}</div>
                        </div>
                    )}
                </div>);
        }

        return (
            <div className="m-2">
                <div><span className="font-italic">{gettext('No Products')}</span></div>
            </div>);
    }

    getContactDetails(company) {
        const contactInfo = company.contact_email ? `${company.contact_name} (${company.contact_email})` : company.contact_name;
        return (
            <div className="d-flex align-items-center m-2">
                <div><span className="font-italic">{gettext('Contact')}: </span>{contactInfo}</div>
                <div className="ml-3"><span className="font-italic">{gettext('Tel')}: </span>{company.phone || '-'}
                </div>
            </div>);
    }

    getUsers(users = []) {
        const usersByGroup = groupBy(users, (u) => u.is_enabled);
        const usersInfo = (userType) => {
            return usersByGroup[userType].map((u) =>
                `${u.first_name} ${u.last_name} (${u.email})`).join(', ');
        };

        if (users.length > 0) {
            return (
                <div className="m-2">
                    <div><span className="font-italic">{gettext('User Accounts')}: </span></div>
                    {Object.keys(usersByGroup).map((userType) =>
                        <div className='pl-3'>{userType === 'true' ? 'Enabled' : 'Disabled'}
                            <div className='d-flex align-items-center pl-3'>{usersInfo(userType)}</div>
                        </div>)
                    }
                </div>);
        }

        return (
            <div className="m-2">
                <div><span className="font-italic">{gettext('No Users')}</span></div>
            </div>);
    }

    render() {
        const {results, print, reportParams, toggleFilterAndQuery} = this.props;
        const headers = [gettext('Company'), gettext('Is Active'), gettext('Account Manager'), gettext('Created'), gettext('Expiry Date')];
        const list = results && results.map((item) =>
            [<tr key={item._id} className="table-secondary">
                <td>{item.name}</td>
                <td className={isInPast(item.company.expiry_date) && item.is_enabled ? 'font-weight-bold text-danger' : null}>
                    {item.is_enabled ? gettext('Active') : gettext('Disabled')}</td>
                <td>{item.account_manager}</td>
                <td>{formatDate(get(item, 'company._created'))}</td>
                <td>{get(item, 'company.expiry_date') ? formatDate(item.company.expiry_date) : gettext('Unspecified')}</td>
            </tr>,
            <tr key={`${item._id}-contact`}>
                <td colSpan="5">
                    {this.getContactDetails(item.company)}
                </td>
            </tr>,
            <tr key={`${item._id}-users`}>
                <td colSpan="5">
                    {this.getUsers(item.users)}
                </td>
            </tr>,
            <tr key={`${item._id}-products`}>
                <td colSpan="5">
                    {this.getProductDetails(item.products)}
                </td>
            </tr>]
        );

        const filterSection = (<Fragment>
            <div key='report_filters' className="align-items-center d-flex flex-sm-nowrap flex-wrap m-0 px-3 wire-column__main-header-agenda">
                {this.filters.map((filter) => (
                    <DropdownFilter
                        key={filter.label}
                        filter={filter}
                        getDropdownItems={this.getDropdownItems}
                        activeFilter={reportParams}
                        getFilterLabel={this.getFilterLabel}
                        toggleFilter={toggleFilterAndQuery}
                    />
                ))}
            </div>
        </Fragment>);

        return [filterSection,
            (<ReportsTable key='report_table' headers={headers} rows={list} print={print} />)];
    }
}

Company.propTypes = {
    results: PropTypes.array,
    print: PropTypes.bool,
    companies: PropTypes.array,
    runReport: PropTypes.func,
    toggleFilterAndQuery: PropTypes.func,
    isLoading: PropTypes.bool,
    reportParams: PropTypes.object,
    sections: PropTypes.array,
};

const mapStateToProps = (state) => ({
    companies: state.companies,
    reportParams: state.reportParams,
    isLoading: state.isLoading,
    sections: state.sections,
});

const mapDispatchToProps = { toggleFilterAndQuery, runReport };

export default connect(mapStateToProps, mapDispatchToProps)(Company);
