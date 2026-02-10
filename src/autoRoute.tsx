import { ComponentType, ReactElement } from "react";
import { Route, useParams } from "react-router-dom";

type SplitOr<S extends string, D extends string> = S extends ""
  ? never
  : S extends `${infer T}${D}${infer U}`
    ? T | SplitOr<U, D>
    : S;

type StripMandatoryPrefix<
  S extends string,
  P extends string,
> = S extends `${P}${infer U}` ? U : never;

type ParamNames<Path extends string> = StripMandatoryPrefix<
  SplitOr<Path, "/">,
  ":"
>;

function InjectParams<
  ParamNames extends string,
  MoreProps extends object,
>(props: {
  Component: ComponentType<Record<ParamNames, string> & MoreProps>;
  moreProps: MoreProps;
}) {
  const { Component } = props;
  const params = useParams() as unknown as Record<ParamNames, string>;
  return <Component {...params} {...props.moreProps} />;
}

export function autoRoute<Path extends string>(
  path: Path,
  Component: ComponentType<Record<ParamNames<Path>, string>>,
): ReactElement;
export function autoRoute<Path extends string, MoreProps extends object>(
  path: Path,
  Component: ComponentType<Record<ParamNames<Path>, string> & MoreProps>,
  moreProps: MoreProps,
): ReactElement;
export function autoRoute<Path extends string, MoreProps extends object>(
  path: Path,
  Component: ComponentType<Record<ParamNames<Path>, string> & MoreProps>,
  moreProps?: MoreProps,
) {
  return (
    <Route
      path={path}
      element={
        <InjectParams<ParamNames<Path>, MoreProps>
          Component={Component}
          moreProps={moreProps ?? ({} as MoreProps)}
        />
      }
    />
  );
}

// note that you can't make an <AutoRoute> component, cuz you'll get
// an error: "[AutoRoute] is not a <Route> component. All component
// children of <Routes> must be a <Route> or <React.Fragment>"
