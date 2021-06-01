import React, {Fragment} from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import { sortBy, cloneDeep, get } from 'lodash';
import ReportsTable from './ReportsTable';
import {toggleFilterAndQuery, runReport, REPORTS, fetchAggregations} from '../actions';
import { gettext } from 'utils';
import MultiSelectDropdown from "../../components/MultiSelectDropdown";

class ProductCompanies extends React.Component {
    constructor(props) {
        super(props);

        this.products = sortBy([...this.props.products.map((p) => ({
            ...p,
            'label': p.name}))
            .concat(...this.props.monitoring.map((m) => ({
                ...m,
                'label': m.name,
                'product_type': 'monitoring'
            })))], ['product_type']);
        this.props.reportParams.section = null;
        this.props.reportParams.product = null;
        this.onChangeSection = this.onChangeSection.bind(this);

        this.state = {
            filters: ['section', 'product'],
            results: [],
            section: {
                field: 'section',
                label: gettext('Sections'),
                options: [],
                onChange: this.onChangeSection,
                showAllButton: true,
                multi: false,
                default: null,
            },
            product: {
                field: 'product',
                label: gettext('Products'),
                options: [],
                onChange: this.props.toggleFilterAndQuery,
                showAllButton: true,
                multi: false,
                default: null,
            },
        };
    }

    componentWillMount() {
        this.props.fetchAggregations(REPORTS['product-companies']);
        // Run report on initial loading with default filters
        this.props.runReport();
    }

    componentWillReceiveProps(nextProps) {
        if (this.props.aggregations !== nextProps.aggregations) {
            this.updateAggregations(nextProps);
        }
    }

    onChangeSection(field, value) {
        this.props.reportParams.product = null;
        this.props.toggleFilterAndQuery('section', value);
        this.props.fetchAggregations(REPORTS['product-companies']);
    }

    updateAggregations(props) {
        const section = cloneDeep(this.state.section);
        const product = cloneDeep(this.state.product);

        if (!props.reportParams.section) {
            section.options = props.sections
                .map((section) => ({
                    label: section.name,
                    value: section.name,
                }));
        }
        product.options = this.products
            .filter((product) => props.aggregations.products.includes(product._id))
            .map((product) => ({
                label: props.reportParams.section ? product.name : product.name.concat(' - ', this.getProductSectionName(product.product_type)),
                value: props.reportParams.section ? product.name : product.name.concat('|', this.getProductSectionName(product.product_type)),
            }));

        this.setState({
            section,
            product,
        });
    }

    getProductSectionName(productType) {
        const { sections } = this.props;
        let section = sections.find(s => s._id === productType);
        return section ? section.name : productType;
    }

    render() {
        const {results, print, reportParams} = this.props;
        const {filters} = this.state;
        const headers = [gettext('Product'), gettext('Active Companies'), gettext('Disabled Companies')];
        const list = get(results, 'length', 0) > 0 ? results.map((item) =>
            <tr key={item._id}>
                <td>{item.product}{!reportParams.section && <span className="font-italic"> {this.getProductSectionName(item.product_type)}</span>}</td>
                <td>{item.enabled_companies.map((company) => (
                    <Fragment key={company}>
                        {company}<br />
                    </Fragment>
                ))}</td>
                <td>{item.disabled_companies.map((company) => (
                    <Fragment key={company}>
                        {company}<br />
                    </Fragment>
                ))}</td>
            </tr>
        ) : ([(<tr key='no_data_row'>
            <td></td>
            <td></td>
            <td></td>
        </tr>)]);

        const filterSection = (<Fragment>
            <div key='report_filters' className="align-items-center d-flex flex-sm-nowrap flex-wrap m-0 px-3 wire-column__main-header-agenda">
                {filters.map((filterName) => {
                    const filter = this.state[filterName];

                    return (
                        <MultiSelectDropdown
                            key={filterName}
                            {...filter}
                            values={reportParams[filter.field] || filter.default}
                        />
                    );
                })}
            </div>
        </Fragment>);

        return [filterSection,
            (<ReportsTable key='report_table' headers={headers} rows={list} print={print} />)];

    }
}

ProductCompanies.propTypes = {
    results: PropTypes.array,
    print: PropTypes.bool,
    sections: PropTypes.array,
    products: PropTypes.array,
    monitoring: PropTypes.array,
    reportParams: PropTypes.object,
    toggleFilterAndQuery: PropTypes.func,
    runReport: PropTypes.func,
    isLoading: PropTypes.bool,
    fetchAggregations: PropTypes.func,
    aggregations: PropTypes.object,
};

const mapStateToProps = (state) => ({
    sections: state.sections,
    products: state.products,
    monitoring: state.monitoring,
    reportParams: state.reportParams,
    isLoading: state.isLoading,
    aggregations: state.reportAggregations,
});

const mapDispatchToProps = { toggleFilterAndQuery, runReport, fetchAggregations};

export default connect(mapStateToProps, mapDispatchToProps)(ProductCompanies);
